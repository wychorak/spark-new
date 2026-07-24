import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, cloudFunctions, db, isFirebaseConfigured } from "./firebase";
import { isSparkOwnerAccount } from "./access";
import { normalizeSparkEvent, sanitizeActiveEvents, type SparkEvent } from "./events";
import { defaultNotificationPreferences, normalizeNotificationPreferences, type NotificationPreferences } from "./notification-preferences";

export type ProfileVerificationStatus = "none" | "pending" | "verified";

export type UserProfileDocument = {
  uid: string;
  firstName: string;
  lastName: string;
  profileNameMode?: "realName" | "nickname";
  nickname?: string;
  gender?: "woman" | "man" | "nonbinary" | "unspecified";
  email: string | null;
  displayName?: string | null;
  intent: string;
  intents?: string[];
  bio?: string;
  ageBand?: "18+" | null;
  age?: number | null;
  interests: string[];
  activeEvents?: SparkEvent[];
  activeEventIds?: string[];
  photoUrls?: string[];
  mainPhotoUrl?: string | null;
  authProvider?: string;
  loginCount?: number;
  lastLoginAt?: unknown;
  city?: string;
  country?: string;
  desiredAgeMin?: number;
  desiredAgeMax?: number;
  maxDistanceKm?: number;
  desiredInterests?: string[];
  desiredIntents?: string[];
  desiredGendersByIntent?: Record<"dating" | "friends" | "community", Array<"woman" | "man" | "nonbinary">>;
  requireCommonInterests?: boolean;
  proOnly?: boolean;
  includeProfilesWithoutLocation?: boolean;
  location?: {
    latitude: number;
    longitude: number;
    geohash?: string;
  } | null;
  socials?: Record<string, string>;
  premiumPlan?: string;
  isPro?: boolean;
  profilePhotoLimit?: number;
  proVisibilityBoost?: "priority" | "standard";
  canSeeIncomingLikes?: boolean;
  canSendChatRequests?: boolean;
  privateProfile?: boolean;
  moderationStatus?: "active" | "suspended";
  verificationStatus?: ProfileVerificationStatus;
  verificationRequestedAt?: unknown;
  verificationReviewedAt?: unknown;
  isVerified?: boolean;
  isTestProfile?: boolean;
  likedYou?: boolean;
  superlikePeriod?: number;
  superlikesUsed?: number;
  onboardingComplete?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const sparkIntentLabels = ["Randki", "Znajomi", "LGBT+ / Społeczność"] as const;

const profileViewWriteCooldownMs = 10 * 60 * 1000;
const recentProfileViewWrites = new Map<string, number>();
const outgoingSwipeCacheTtlMs = 60 * 1000;

type OutgoingProfileSwipe = {
  id: string;
  fromUid: string;
  toProfileKey: string;
  status: "liked" | "passed";
  direction: "pass" | "like" | "superlike";
  resetAtMs: number | null;
};

const outgoingSwipeCache = new Map<string, { expiresAt: number; items: OutgoingProfileSwipe[] }>();

function invalidateOutgoingSwipeCache(uid: string) {
  outgoingSwipeCache.delete(uid);
}

function normalizeSparkIntents(value: unknown, legacyIntent?: unknown) {
  const source = Array.isArray(value) ? value : legacyIntent ? [legacyIntent] : [];
  return Array.from(new Set(
    source
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => sparkIntentLabels.includes(item as typeof sparkIntentLabels[number]))
  )).slice(0, 3) as string[];
}

const discoverableGenders = ["woman", "man", "nonbinary"] as const;

type DiscoverableGender = typeof discoverableGenders[number];
type GenderPreferencesByIntent = Record<"dating" | "friends" | "community", DiscoverableGender[]>;

function normalizeProfileGender(value: unknown): "woman" | "man" | "nonbinary" | "unspecified" {
  return value === "woman" || value === "man" || value === "nonbinary" || value === "unspecified" ? value : "unspecified";
}

function normalizeDesiredGenders(value: unknown): DiscoverableGender[] {
  if (!Array.isArray(value)) return [...discoverableGenders];
  const normalized = Array.from(new Set(value.filter((item): item is DiscoverableGender => discoverableGenders.includes(item as DiscoverableGender))));
  return normalized.length > 0 ? normalized : [...discoverableGenders];
}

function normalizeGenderPreferences(value: unknown): GenderPreferencesByIntent {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    dating: normalizeDesiredGenders(source.dating),
    friends: normalizeDesiredGenders(source.friends),
    community: normalizeDesiredGenders(source.community)
  };
}

function roundPublicCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

function getApproximatePublicLocation(location: UserProfileDocument["location"]) {
  if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    return null;
  }

  return {
    latitude: roundPublicCoordinate(location.latitude),
    longitude: roundPublicCoordinate(location.longitude)
  };
}

function sanitizePublicSocials(socials: UserProfileDocument["socials"]) {
  const allowed = ["Instagram", "TikTok", "Facebook"] as const;
  return Object.fromEntries(
    allowed
      .map((label) => [label, typeof socials?.[label] === "string" ? socials[label].trim().replace(/^@+/, "").slice(0, 40) : ""] as const)
      .filter(([, value]) => value.length > 0 && /^[a-zA-Z0-9._-]+$/.test(value))
  );
}

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Usługa danych Spark jest chwilowo niedostępna. Spróbuj ponownie później.");
  }

  return db;
}

function requireCurrentUserUid(expectedUid?: string) {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error("Musisz być zalogowany, aby wykonać tę operację.");
  }
  if (expectedUid && uid !== expectedUid) {
    throw new Error("Identyfikator użytkownika nie pasuje do zalogowanego konta.");
  }
  return uid;
}

async function keepPublishedSparkEvents(eventsInput: unknown) {
  const events = sanitizeActiveEvents(eventsInput);
  if (events.length === 0) return [];
  const snapshots = await Promise.all(events.map((event) => getDoc(doc(requireDb(), "sparkEvents", event.id))));
  const publishedIds = new Set(
    snapshots
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => normalizeSparkEvent({ id: snapshot.id, ...snapshot.data() }))
      .filter((event): event is SparkEvent => Boolean(event))
      .map((event) => event.id)
  );
  return events.filter((event) => publishedIds.has(event.id));
}

async function getVerifiedProClaim(uid: string) {
  const currentUser = auth?.currentUser;
  if (!currentUser || currentUser.uid !== uid) return false;

  if (isSparkOwnerAccount(currentUser.email, currentUser.emailVerified)) return true;

  const token = await currentUser.getIdTokenResult();
  const entitlements = token.claims.activeEntitlements;
  return Array.isArray(entitlements) && entitlements.includes("Sparknew Pro");
}

export type ProfileViewDocument = {
  viewerUid: string;
  targetUid: string;
  viewCount: number;
  lastViewedAtMs: number | null;
};

export async function recordCurrentUserProfileView(targetUid: string) {
  const viewerUid = auth?.currentUser?.uid;
  if (!viewerUid || !targetUid || viewerUid === targetUid) return;

  const writeKey = viewerUid + ":" + targetUid;
  const now = Date.now();
  if (now - (recentProfileViewWrites.get(writeKey) ?? 0) < profileViewWriteCooldownMs) return;
  recentProfileViewWrites.set(writeKey, now);

  await setDoc(
    doc(requireDb(), "users", targetUid, "profileViews", viewerUid),
    { viewerUid, targetUid, viewCount: increment(1), lastViewedAt: serverTimestamp() },
    { merge: true }
  );
}

export function observeRecentProfileViews(
  uid: string,
  onChange: (views: ProfileViewDocument[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    query(collection(requireDb(), "users", uid, "profileViews"), orderBy("lastViewedAt", "desc"), limit(100)),
    (snapshot) => onChange(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        viewerUid: String(data.viewerUid ?? item.id),
        targetUid: String(data.targetUid ?? uid),
        viewCount: typeof data.viewCount === "number" ? data.viewCount : 1,
        lastViewedAtMs: typeof data.lastViewedAt?.toMillis === "function" ? data.lastViewedAt.toMillis() : null
      };
    })),
    (error) => onError?.(error)
  );
}

export async function syncPublicUserProfile(uid: string, verifiedIsPro?: boolean) {
  requireCurrentUserUid(uid);
  const currentDb = requireDb();
  const claimIsPro = typeof verifiedIsPro === "boolean" ? verifiedIsPro : await getVerifiedProClaim(uid);
  const accountSnapshot = await getDoc(doc(currentDb, "users", uid));
  const publicProfileRef = doc(currentDb, "publicProfiles", uid);

  if (!accountSnapshot.exists()) {
    await deleteDoc(publicProfileRef);
    return;
  }

  const profile = accountSnapshot.data() as UserProfileDocument;
  const isPublishable =
    profile.moderationStatus !== "suspended" &&
    profile.onboardingComplete === true &&
    profile.ageBand === "18+" &&
    typeof profile.age === "number" &&
    profile.age >= 18 &&
    Array.isArray(profile.interests) &&
    profile.interests.length >= 3 &&
    Array.isArray(profile.photoUrls) &&
    profile.photoUrls.length >= 1;
  if (!isPublishable) {
    await deleteDoc(publicProfileRef);
    return;
  }

  const existingPublic = await getDoc(publicProfileRef);
  const existingData = existingPublic.exists() ? existingPublic.data() : {};
  const publicPhotoUrls = (profile.photoUrls ?? []).filter((url): url is string => typeof url === "string").slice(0, claimIsPro ? 15 : 3);
  const publicMainPhotoUrl = typeof profile.mainPhotoUrl === "string" && publicPhotoUrls.includes(profile.mainPhotoUrl)
    ? profile.mainPhotoUrl
    : publicPhotoUrls[0] ?? null;
  const intents = normalizeSparkIntents(profile.intents, profile.intent);
  const desiredAgeMin = Math.max(18, Math.min(99, profile.desiredAgeMin ?? 18));
  const desiredAgeMax = Math.max(desiredAgeMin, Math.min(99, profile.desiredAgeMax ?? 99));
  const activeEvents = await keepPublishedSparkEvents(profile.activeEvents);
  await setDoc(publicProfileRef, {
    uid,
    firstName: profile.firstName,
    lastName: profile.lastName,
    profileNameMode: profile.profileNameMode ?? "realName",
    nickname: profile.nickname ?? "",
    gender: normalizeProfileGender(profile.gender),
    intent: intents[0] ?? "Randki",
    intents,
    bio:
      typeof profile.bio === "string" && profile.bio.trim().length >= 20
        ? profile.bio.trim().slice(0, 300)
        : "Poznajmy si\u0119 przez wsp\u00f3lne zainteresowania i dobr\u0105 rozmow\u0119.",
    ageBand: profile.ageBand ?? null,
    age: profile.age ?? null,
    desiredAgeMin,
    desiredAgeMax,
    desiredGendersByIntent: normalizeGenderPreferences(profile.desiredGendersByIntent),
    interests: profile.interests,
    activeEvents,
    activeEventIds: activeEvents.map((event) => event.id),
    photoUrls: publicPhotoUrls,
    mainPhotoUrl: publicMainPhotoUrl,
    city: profile.city ?? "",
    country: profile.country ?? "",
    location: getApproximatePublicLocation(profile.location),
    socials: sanitizePublicSocials(profile.socials),
    isPro: claimIsPro,
    isTestProfile: existingData.isTestProfile === true,
    isVerified: existingData.isVerified === true,
    moderationStatus: existingData.moderationStatus === "suspended" ? "suspended" : "active",
    createdAt: existingPublic.exists() ? existingData.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function upsertUserProfile(profile: UserProfileDocument) {
  requireCurrentUserUid(profile.uid);
  const currentDb = requireDb();
  const profileRef = doc(currentDb, "users", profile.uid);
  const existing = await getDoc(profileRef);

  await setDoc(
    profileRef,
    {
      ...profile,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  await syncPublicUserProfile(profile.uid);
}

export type DiscoveryPreferencesDocument = {
  desiredAgeMin: number;
  desiredAgeMax: number;
  maxDistanceKm: number;
  desiredInterests: string[];
  desiredIntents: string[];
  desiredGendersByIntent: GenderPreferencesByIntent;
  requireCommonInterests: boolean;
  proOnly: boolean;
  includeProfilesWithoutLocation: boolean;
};

export async function loadNotificationPreferences(uid: string) {
  requireCurrentUserUid(uid);
  const snapshot = await getDoc(doc(requireDb(), "users", uid, "settings", "notifications"));
  return normalizeNotificationPreferences(snapshot.exists() ? snapshot.data() : defaultNotificationPreferences);
}

export async function saveNotificationPreferences(uid: string, preferences: NotificationPreferences) {
  requireCurrentUserUid(uid);
  const currentDb = requireDb();
  const normalized = normalizeNotificationPreferences(preferences);
  await setDoc(
    doc(currentDb, "users", uid, "settings", "notifications"),
    { ...normalized, updatedAt: serverTimestamp() },
    { merge: true }
  );

  const devices = await getDocs(collection(currentDb, "users", uid, "devices"));
  await Promise.all(devices.docs.map((device) => updateDoc(device.ref, {
    notificationPreferences: normalized,
    updatedAt: serverTimestamp()
  })));
  return normalized;
}

export async function registerDevicePushToken(uid: string, token: string, platform: "ios" | "android", preferences?: NotificationPreferences) {
  requireCurrentUserUid(uid);
  const currentDb = requireDb();
  const tokenId = token.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-180);
  const normalized = normalizeNotificationPreferences(preferences ?? await loadNotificationPreferences(uid));

  await setDoc(
    doc(currentDb, "users", uid, "devices", tokenId),
    {
      token,
      platform,
      enabled: true,
      notificationPreferences: normalized,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function updateUserDiscoveryPreferences(uid: string, preferences: DiscoveryPreferencesDocument) {
  requireCurrentUserUid(uid);
  const currentDb = requireDb();

  await setDoc(
    doc(currentDb, "users", uid),
    { ...preferences, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await syncPublicUserProfile(uid);
}

export async function updateUserActiveEvents(uid: string, events: SparkEvent[]) {
  requireCurrentUserUid(uid);
  const requestedEvents = sanitizeActiveEvents(events);
  const callable = httpsCallable<{ eventIds: string[] }, { events: SparkEvent[] }>(requireCloudFunctions(), "updateActiveEvents");
  try {
    const response = await callable({ eventIds: requestedEvents.map((event) => event.id) });
    return sanitizeActiveEvents(response.data.events);
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się zapisać udziału w wydarzeniach. Spróbuj ponownie."));
  }
}

export function observeSparkEvents(
  onChange: (events: SparkEvent[]) => void,
  onError: (error: Error) => void
) {
  const eventsQuery = query(collection(requireDb(), "sparkEvents"), orderBy("startsAt", "asc"), limit(50));
  return onSnapshot(
    eventsQuery,
    (snapshot) => onChange(sanitizeActiveEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))),
    (error) => onError(error)
  );
}

export async function publishSparkEvent(uid: string, eventInput: SparkEvent) {
  requireCurrentUserUid(uid);
  const event = normalizeSparkEvent(eventInput);
  if (!event) throw new Error("Nieprawidłowe dane wydarzenia.");
  const deleteAtMs = new Date(event.endsAt).getTime() + 60 * 60 * 1000;
  if (!Number.isFinite(deleteAtMs) || deleteAtMs <= Date.now()) {
    throw new Error("Wydarzenie musi kończyć się w przyszłości.");
  }

  await setDoc(doc(requireDb(), "sparkEvents", event.id), {
    ...event,
    createdByUid: uid,
    deleteAt: Timestamp.fromMillis(deleteAtMs),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return event;
}

export async function removeSparkEvent(eventId: string) {
  await deleteDoc(doc(requireDb(), "sparkEvents", eventId));
}

export async function recordUserLogin(params: {
  uid: string;
  email: string | null;
  displayName: string | null;
  authProvider: "email" | "google" | "apple" | "demo";
  fallbackFirstName?: string;
  fallbackLastName?: string;
}) {
  requireCurrentUserUid(params.uid);
  const currentDb = requireDb();
  const profileRef = doc(currentDb, "users", params.uid);
  const existing = await getDoc(profileRef);
  const nameParts = (params.displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = params.fallbackFirstName || nameParts[0] || (params.authProvider === "demo" ? "Tester" : "");
  const lastName = params.fallbackLastName || nameParts.slice(1).join(" ") || (params.authProvider === "demo" ? "Spark" : "");

  await setDoc(
    profileRef,
    {
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      authProvider: params.authProvider,
      loginCount: increment(1),
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(existing.exists()
        ? {}
        : {
            firstName,
            lastName,
            intent: "Randki",
            intents: ["Randki"],
            desiredIntents: ["Randki"],
            ageBand: params.authProvider === "demo" ? "18+" : null,
            interests: [],
            premiumPlan: "free",
            privateProfile: false,
            onboardingComplete: false,
            createdAt: serverTimestamp()
          })
    },
    { merge: true }
  );
}

export type UserPrivateSettingsDocument = {
  birthDate?: string;
};

export async function upsertUserPrivateSettings(uid: string, settings: UserPrivateSettingsDocument) {
  requireCurrentUserUid(uid);
  const currentDb = requireDb();
  await setDoc(
    doc(currentDb, "privateProfiles", uid),
    { ...settings, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getUserPrivateSettings(uid: string) {
  const currentDb = requireDb();
  const snapshot = await getDoc(doc(currentDb, "privateProfiles", uid));
  return snapshot.exists() ? (snapshot.data() as UserPrivateSettingsDocument) : null;
}

export async function getUserProfile(uid: string) {
  const currentDb = requireDb();
  const snapshot = await getDoc(doc(currentDb, "users", uid));
  return snapshot.exists() ? (snapshot.data() as UserProfileDocument) : null;
}

export function observeVerificationStatus(
  uid: string,
  onChange: (status: ProfileVerificationStatus) => void,
  onError?: (error: Error) => void
) {
  requireCurrentUserUid(uid);
  return onSnapshot(
    doc(requireDb(), "users", uid),
    (snapshot) => {
      const value = snapshot.data()?.verificationStatus;
      onChange(value === "verified" ? "verified" : value === "pending" ? "pending" : "none");
    },
    (error) => onError?.(error)
  );
}

export function observeModerationStatus(
  uid: string,
  onChange: (status: "active" | "suspended") => void,
  onError?: (error: Error) => void
) {
  requireCurrentUserUid(uid);
  return onSnapshot(
    doc(requireDb(), "users", uid),
    (snapshot) => onChange(snapshot.data()?.moderationStatus === "suspended" ? "suspended" : "active"),
    (error) => onError?.(error)
  );
}

export async function getPublicProfile(uid: string) {
  const currentDb = requireDb();
  const snapshot = await getDoc(doc(currentDb, "publicProfiles", uid));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserProfileDocument & { id: string }) : null;
}

export async function getPublicProfiles(uids: string[]) {
  const normalizedUids = Array.from(new Set(uids.filter((uid) => typeof uid === "string" && uid.length > 0 && !uid.includes("/"))));
  if (normalizedUids.length === 0) return [];

  const publicProfiles = collection(requireDb(), "publicProfiles");
  const batches = Array.from({ length: Math.ceil(normalizedUids.length / 30) }, (_, index) => normalizedUids.slice(index * 30, index * 30 + 30));
  const snapshots = await Promise.all(batches.map((batch) => getDocs(query(publicProfiles, where(documentId(), "in", batch)))));
  const profilesById = new Map<string, UserProfileDocument & { id: string }>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => profilesById.set(item.id, { id: item.id, ...(item.data() as UserProfileDocument) })));
  return normalizedUids.map((uid) => profilesById.get(uid) ?? null);
}

export async function requestAccountDeletionAndDeleteProfile(params: {
  uid: string;
  reason?: string;
}) {
  requireCurrentUserUid(params.uid);
  const callable = httpsCallable<
    { reason?: string },
    { deleted: true }
  >(requireCloudFunctions(), "deleteSparkAccount");
  try {
    await callable({ reason: params.reason });
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się usunąć konta i danych. Spróbuj ponownie."));
  }
}

export async function findTestProfiles() {
  const currentDb = requireDb();
  const snapshot = await getDocs(
    query(collection(currentDb, "publicProfiles"), where("isTestProfile", "==", true), limit(10))
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as UserProfileDocument) }));
}

export type DiscoveryCursor = QueryDocumentSnapshot<DocumentData>;

export async function findProfilesByInterest(interests: string[], cursor: DiscoveryCursor | null = null, intents: string[] = [], city = "") {
  const currentDb = requireDb();
  const publicProfiles = collection(currentDb, "publicProfiles");
  const pageSize = 24;
  const pageQuery = cursor
    ? query(publicProfiles, orderBy("updatedAt", "desc"), startAfter(cursor), limit(pageSize))
    : query(publicProfiles, orderBy("updatedAt", "desc"), limit(pageSize));
  const normalizedIntents = Array.from(new Set(intents.filter((value) => sparkIntentLabels.includes(value as typeof sparkIntentLabels[number])))).slice(0, 3);
  void city;
  const [pageSnapshot, interestSnapshot, intentSnapshot] = await Promise.all([
    getDocs(pageQuery),
    !cursor && interests.length > 0
      ? getDocs(query(publicProfiles, where("interests", "array-contains-any", interests.slice(0, 10)), limit(20)))
      : Promise.resolve(null),
    !cursor && normalizedIntents.length > 0
      ? getDocs(query(publicProfiles, where("intents", "array-contains-any", normalizedIntents), limit(30)))
      : Promise.resolve(null)
  ]);
  const profiles = new Map<string, { id: string; [key: string]: unknown }>();
  [interestSnapshot, intentSnapshot, pageSnapshot].forEach((snapshot) => {
    snapshot?.docs.forEach((item) => profiles.set(item.id, { id: item.id, ...item.data() }));
  });
  return {
    profiles: Array.from(profiles.values()),
    nextCursor: pageSnapshot.docs.at(-1) ?? null,
    hasMore: pageSnapshot.size === pageSize
  };
}

export async function findProfilesByActiveEvents(eventIds: string[]) {
  const normalizedIds = Array.from(new Set(eventIds.filter((value) => typeof value === "string" && value.length > 0))).slice(0, 10);
  if (normalizedIds.length === 0) return [];
  const snapshot = await getDocs(
    query(collection(requireDb(), "publicProfiles"), where("activeEventIds", "array-contains-any", normalizedIds), limit(50))
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function findIncomingProfileLikes(toUid: string) {
  const currentDb = requireDb();
  const snapshot = await getDocs(
    query(collection(currentDb, "swipes"), where("toProfileKey", "==", toUid), limit(100))
  );

  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        fromUid: String(data.fromUid ?? ""),
        direction: data.direction === "superlike" ? "superlike" as const : "like" as const,
        status: String(data.status ?? "")
      };
    })
    .filter((item) => item.fromUid && item.status === "liked");
}

export async function getMonthlySuperlikeUsage(uid: string) {
  const currentDb = requireDb();
  const snapshot = await getDoc(doc(currentDb, "users", uid));
  const data = snapshot.exists() ? snapshot.data() : {};
  const now = new Date();
  const currentPeriod = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
  return data.superlikePeriod === currentPeriod && typeof data.superlikesUsed === "number" ? data.superlikesUsed : 0;
}

export type ModerationReport = {
  id: string;
  reporterUid: string;
  targetUid: string;
  reason: string;
  context: string;
  status: "open" | "dismissed" | "warned" | "suspended";
  createdAtMs: number;
};

export async function listModerationReports() {
  const callable = httpsCallable<Record<string, never>, { reports: ModerationReport[] }>(requireCloudFunctions(), "listModerationReports");
  try {
    return (await callable({})).data.reports;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się pobrać kolejki moderacji."));
  }
}

export async function resolveModerationReport(reportId: string, action: "dismiss" | "warn" | "suspend") {
  const callable = httpsCallable<{ reportId: string; action: "dismiss" | "warn" | "suspend" }, { ok: true }>(requireCloudFunctions(), "resolveModerationReport");
  try {
    await callable({ reportId, action });
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się zaktualizować zgłoszenia."));
  }
}
export async function syncProfileVerification() {
  const callable = httpsCallable<Record<string, never>, { status: ProfileVerificationStatus }>(requireCloudFunctions(), "syncProfileVerification");
  try {
    return (await callable({})).data;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się odświeżyć statusu weryfikacji."));
  }
}

export async function createReport(params: {
  reporterUid: string;
  targetUid: string;
  reason: string;
  context?: string;
}) {
  requireCurrentUserUid(params.reporterUid);
  const currentDb = requireDb();
  const reportRef = doc(collection(currentDb, "reports"));

  await setDoc(reportRef, {
    ...params,
    status: "open",
    createdAt: serverTimestamp()
  });

  return reportRef.id;
}

export async function recordProfileSwipe(params: {
  swipeId: string;
  fromUid: string;
  toProfileKey: string;
  direction: "pass" | "like" | "superlike";
  matchScore?: number;
  eventContext?: SparkEvent;
  resetAtMs?: number;
}) {
  requireCurrentUserUid(params.fromUid);
  const currentDb = requireDb();
  const swipeRef = doc(currentDb, "swipes", params.swipeId);

  const swipeData = {
    fromUid: params.fromUid,
    toProfileKey: params.toProfileKey,
    direction: params.direction,
    status: params.direction === "pass" ? "passed" : "liked",
    matchScore: params.matchScore ?? null,
    eventContext: params.eventContext ? sanitizeActiveEvents([params.eventContext])[0] ?? null : null,
    resetAt: params.resetAtMs ? new Date(params.resetAtMs) : null,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  };

  if (params.direction === "superlike") {
    const accountRef = doc(currentDb, "users", params.fromUid);
    const superlikesRemaining = await runTransaction(currentDb, async (transaction) => {
      const [accountSnapshot, swipeSnapshot] = await Promise.all([
        transaction.get(accountRef),
        transaction.get(swipeRef)
      ]);
      if (!accountSnapshot.exists()) {
        throw new Error("Nie znaleziono konta użytkownika.");
      }

      const account = accountSnapshot.data();
      const now = new Date();
      const currentPeriod = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
      const used = account.superlikePeriod === currentPeriod && typeof account.superlikesUsed === "number"
        ? account.superlikesUsed
        : 0;
      if (swipeSnapshot.exists() && swipeSnapshot.data().direction === "superlike") {
        return Math.max(0, 10 - used);
      }
      if (used >= 10) {
        throw new Error("Miesięczny limit SparkLike został wykorzystany.");
      }

      transaction.set(swipeRef, swipeData, { merge: true });
      transaction.update(accountRef, {
        superlikePeriod: currentPeriod,
        superlikesUsed: used + 1,
        updatedAt: serverTimestamp()
      });
      return 10 - used - 1;
    });

    invalidateOutgoingSwipeCache(params.fromUid);
    return { id: swipeRef.id, superlikesRemaining };
  }

  await setDoc(swipeRef, swipeData, { merge: true });
  invalidateOutgoingSwipeCache(params.fromUid);
  return { id: swipeRef.id };
}
export async function hasIncomingProfileLike(params: {
  swipeId: string;
  fromUid: string;
  toUid: string;
}) {
  const currentDb = requireDb();
  const snapshot = await getDoc(doc(currentDb, "swipes", params.swipeId));

  if (!snapshot.exists()) {
    return false;
  }

  const data = snapshot.data();
  return data.fromUid === params.fromUid && data.toProfileKey === params.toUid && data.status === "liked";
}

export async function findOutgoingProfileSwipes(fromUid: string) {
  const now = Date.now();
  const cached = outgoingSwipeCache.get(fromUid);
  if (cached && cached.expiresAt > now) return cached.items;

  const currentDb = requireDb();
  const snapshot = await getDocs(
    query(collection(currentDb, "swipes"), where("fromUid", "==", fromUid), limit(250))
  );

  const items = snapshot.docs
    .map((item) => {
      const data = item.data();
      const resetAtMs = typeof data.resetAt?.toMillis === "function" ? data.resetAt.toMillis() : null;
      return { id: item.id, ...data, resetAtMs } as OutgoingProfileSwipe;
    })
    .filter((item) => item.resetAtMs === null || item.resetAtMs > now);
  outgoingSwipeCache.set(fromUid, { expiresAt: now + outgoingSwipeCacheTtlMs, items });
  return items;
}

export async function findMatchThreadsForUser(uid: string) {
  const currentDb = requireDb();
  const snapshot = await getDocs(
    query(collection(currentDb, "matches"), where("memberUids", "array-contains", uid), limit(100))
  );

  const now = Date.now();
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      const resetAtMs = typeof data.resetAt?.toMillis === "function" ? data.resetAt.toMillis() : null;
      return { id: item.id, ...data, resetAtMs } as {
        id: string;
        memberUids: string[];
        status: "matched" | "requested";
        resetAtMs: number | null;
      };
    })
    .filter((item) => item.resetAtMs === null || item.resetAtMs > now);
}

type PremiumChatRequestResponse = {
  status: "requested" | "matched";
  threadId: string;
  remainingToday: number;
};

function requireCloudFunctions() {
  if (!cloudFunctions) {
    throw new Error("Usługa wiadomości jest chwilowo niedostępna.");
  }
  return cloudFunctions;
}

function getCallableErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const message = error.message.replace(/^FirebaseError:\s*/i, "").trim();
    const technicalError = /missing or insufficient permissions|internal|network|unavailable|deadline-exceeded/i.test(message);
    if (message && !technicalError) return message;
  }
  return fallback;
}

export async function createPremiumChatRequest(params: {
  targetUid: string;
  introMessage: string;
  eventContext?: SparkEvent;
}) {
  requireCurrentUserUid();
  const callable = httpsCallable<
    { targetUid: string; introMessage: string; eventId?: string },
    PremiumChatRequestResponse
  >(requireCloudFunctions(), "createPremiumChatRequest");

  try {
    const response = await callable({
      targetUid: params.targetUid,
      introMessage: params.introMessage.trim(),
      eventId: params.eventContext?.id
    });
    return response.data;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się wysłać prośby. Spróbuj ponownie."));
  }
}

export async function createMatchThread(params: {
  matchId: string;
  memberUids: string[];
  createdByUid: string;
  source: "mutual-like" | "premium-request" | "superlike";
  introMessage?: string;
  eventContext?: SparkEvent;
  resetAtMs?: number;
}) {
  const currentUid = requireCurrentUserUid(params.createdByUid);
  const uniqueMemberUids = Array.from(new Set(params.memberUids));
  if (uniqueMemberUids.length !== 2 || !uniqueMemberUids.includes(currentUid)) {
    throw new Error("Match musi łączyć dwa różne identyfikatory użytkowników.");
  }
  const currentDb = requireDb();
  const matchRef = doc(currentDb, "matches", params.matchId);

  const staleSnapshot = await getDoc(matchRef);
  if (staleSnapshot.exists()) {
    const staleData = staleSnapshot.data();
    const resetAtMs = typeof staleData.resetAt?.toMillis === "function" ? staleData.resetAt.toMillis() : null;
    if (resetAtMs !== null && resetAtMs <= Date.now() && ["matched", "requested"].includes(String(staleData.status))) {
      const callable = httpsCallable<
        { threadId: string; mode: "expired" },
        { deleted: boolean }
      >(requireCloudFunctions(), "deleteMatchThread");
      await callable({ threadId: params.matchId, mode: "expired" });
    }
  }


  await runTransaction(currentDb, async (transaction) => {
    const snapshot = await transaction.get(matchRef);
    if (snapshot.exists()) {
      const existing = snapshot.data();
      if (existing.status === "matched") return;
      if (existing.status === "requested") {
        if (params.source !== "premium-request") {
          transaction.update(matchRef, {
            status: "matched",
            acceptedByUid: params.createdByUid,
            updatedAt: serverTimestamp()
          });
        }
        return;
      }
      throw new Error("Ta rozmowa została wcześniej zamknięta.");
    }

    transaction.set(matchRef, {
      memberUids: params.memberUids,
      createdByUid: params.createdByUid,
      source: params.source,
      introMessage: params.introMessage?.trim() ?? null,
      eventContext: params.eventContext ? sanitizeActiveEvents([params.eventContext])[0] ?? null : null,
      status: params.source === "premium-request" ? "requested" : "matched",
      resetAt: params.resetAtMs ? new Date(params.resetAtMs) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return matchRef.id;
}

export async function sendChatMessage(params: {
  threadId: string;
  senderUid: string;
  text: string;
}) {
  requireCurrentUserUid(params.senderUid);
  const text = params.text.trim();
  if (!text || text.length > 2000) {
    throw new Error("Wiadomość musi mieć od 1 do 2000 znaków.");
  }
  const callable = httpsCallable<
    { threadId: string; text: string },
    { messageId: string }
  >(requireCloudFunctions(), "sendChatMessage");

  try {
    const response = await callable({ threadId: params.threadId, text });
    return response.data.messageId;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się wysłać wiadomości. Spróbuj ponownie."));
  }
}


export async function markChatThreadRead(params: { threadId: string; uid: string }) {
  requireCurrentUserUid(params.uid);
  const callable = httpsCallable<{ threadId: string }, { ok: true }>(requireCloudFunctions(), "markChatThreadRead");

  try {
    await callable({ threadId: params.threadId });
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się oznaczyć rozmowy jako przeczytanej."));
  }
}


export type RealtimeChatThread = {
  id: string;
  memberUids: string[];
  createdByUid: string;
  createdAtMs: number | null;
  status: "matched" | "requested";
  introMessage?: string;
  eventContext?: SparkEvent;
  unreadCount: number;
  lastMessageText?: string;
  lastMessageAtMs?: number | null;
  messages: Array<{ id: string; senderUid: string; text: string; createdAtMs: number | null }>;
};

export function observeUserChats(uid: string, onChange: (threads: RealtimeChatThread[]) => void, onError?: (error: Error) => void) {
  const currentDb = requireDb();
  return onSnapshot(
    query(collection(currentDb, "matches"), where("memberUids", "array-contains", uid), limit(100)),
    (snapshot) => {
      const threads = snapshot.docs.reduce<RealtimeChatThread[]>((items, item) => {
        const data = item.data();
        const resetAtMs = typeof data.resetAt?.toMillis === "function" ? data.resetAt.toMillis() : null;
        if ((resetAtMs !== null && resetAtMs <= Date.now()) || (data.status !== "matched" && data.status !== "requested")) return items;
        items.push({
          id: item.id,
          memberUids: Array.isArray(data.memberUids) ? data.memberUids : [],
          createdByUid: String(data.createdByUid ?? ""),
          createdAtMs: typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : null,
          status: data.status,
          introMessage: typeof data.introMessage === "string" ? data.introMessage : undefined,
          eventContext: normalizeSparkEvent(data.eventContext) ?? undefined,
          unreadCount: Math.max(0, Math.min(999, Number(data.unreadCountByUid?.[uid] ?? 0) || 0)),
          lastMessageText: typeof data.lastMessageText === "string" ? data.lastMessageText : undefined,
          lastMessageAtMs: typeof data.lastMessageAt?.toMillis === "function" ? data.lastMessageAt.toMillis() : null,
          messages: []
        });
        return items;
      }, []);
      threads.sort((left, right) => (right.lastMessageAtMs ?? right.createdAtMs ?? 0) - (left.lastMessageAtMs ?? left.createdAtMs ?? 0));
      onChange(threads);
    },
    (error) => onError?.(error)
  );
}

export function observeChatMessages(
  threadId: string,
  onChange: (messages: RealtimeChatThread["messages"]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    query(collection(requireDb(), "messages", threadId, "items"), orderBy("createdAt", "desc"), limit(100)),
    (snapshot) => onChange(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        senderUid: String(data.senderUid ?? ""),
        text: String(data.text ?? ""),
        createdAtMs: typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : null
      };
    }).reverse()),
    (error) => onError?.(error)
  );
}

export function observeBlockedProfileKeys(uid: string, onChange: (profileKeys: string[]) => void, onError?: (error: Error) => void) {
  const currentDb = requireDb();
  return onSnapshot(collection(currentDb, "users", uid, "blocks"), (snapshot) => onChange(snapshot.docs.map((item) => String(item.data().blockedUid ?? item.id))), (error) => onError?.(error));
}

export async function acceptChatRequest(threadId: string, uid: string) {
  requireCurrentUserUid(uid);
  await updateDoc(doc(requireDb(), "matches", threadId), { status: "matched", acceptedByUid: uid, updatedAt: serverTimestamp() });
}

export async function rejectChatRequest(threadId: string, uid: string) {
  requireCurrentUserUid(uid);
  await updateDoc(doc(requireDb(), "matches", threadId), { status: "rejected", rejectedByUid: uid, updatedAt: serverTimestamp() });
}
export async function cancelChatRequest(threadId: string) {
  requireCurrentUserUid();
  const callable = httpsCallable<
    { threadId: string; mode: "cancel" },
    { deleted: boolean }
  >(requireCloudFunctions(), "deleteMatchThread");
  try {
    await callable({ threadId, mode: "cancel" });
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się anulować prośby. Spróbuj ponownie."));
  }
}

export async function resetPassedProfiles() {
  const uid = requireCurrentUserUid();
  const callable = httpsCallable<Record<string, never>, { removed: number }>(requireCloudFunctions(), "resetPassedProfiles");
  try {
    const response = await callable({});
    invalidateOutgoingSwipeCache(uid);
    return response.data;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się przywrócić pominiętych profili. Spróbuj ponownie."));
  }
}

export async function cancelProfileLike(targetUid: string) {
  const uid = requireCurrentUserUid();
  const callable = httpsCallable<{ targetUid: string }, { removed: number }>(requireCloudFunctions(), "cancelProfileLike");
  try {
    const response = await callable({ targetUid });
    invalidateOutgoingSwipeCache(uid);
    return response.data;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się usunąć polubienia. Spróbuj ponownie."));
  }
}

export async function sendSparkLike(params: { targetUid: string; matchScore?: number; eventId?: string }) {
  const uid = requireCurrentUserUid();
  const callable = httpsCallable<
    { targetUid: string; matchScore?: number; eventId?: string },
    { status: "matched"; threadId: string; superlikesRemaining: number }
  >(requireCloudFunctions(), "sendSparkLike");
  try {
    const response = await callable(params);
    invalidateOutgoingSwipeCache(uid);
    return response.data;
  } catch (error) {
    throw new Error(getCallableErrorMessage(error, "Nie udało się wysłać SparkLike. Spróbuj ponownie."));
  }
}


export async function blockUser(params: { blockerUid: string; blockedUid: string; threadId?: string }) {
  requireCurrentUserUid(params.blockerUid);
  const currentDb = requireDb();
  const blockRef = doc(currentDb, "users", params.blockerUid, "blocks", params.blockedUid);
  await runTransaction(currentDb, async (transaction) => {
    const matchRef = params.threadId ? doc(currentDb, "matches", params.threadId) : null;
    const matchSnapshot = matchRef ? await transaction.get(matchRef) : null;
    transaction.set(blockRef, { blockedUid: params.blockedUid, createdAt: serverTimestamp() });
    if (matchRef && matchSnapshot?.exists() && ["matched", "requested"].includes(String(matchSnapshot.data().status))) {
      transaction.update(matchRef, { status: "blocked", blockedByUid: params.blockerUid, updatedAt: serverTimestamp() });
    }
  });
}
export async function unblockUser(blockerUid: string, blockedUid: string) {
  requireCurrentUserUid(blockerUid);
  if (!blockedUid || blockedUid.includes("/") || blockedUid === blockerUid) {
    throw new Error("Nieprawidłowy profil do odblokowania.");
  }
  await deleteDoc(doc(requireDb(), "users", blockerUid, "blocks", blockedUid));
}
