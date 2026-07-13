import {
  collection,
  deleteDoc,
  doc,
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
  updateDoc,
  where
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";

export type UserProfileDocument = {
  uid: string;
  firstName: string;
  lastName: string;
  profileNameMode?: "realName" | "nickname";
  nickname?: string;
  email: string | null;
  displayName?: string | null;
  intent: string;
  ageBand?: "18+" | null;
  age?: number | null;
  interests: string[];
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
  requireCommonInterests?: boolean;
  proOnly?: boolean;
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
  isTestProfile?: boolean;
  likedYou?: boolean;
  superlikePeriod?: number;
  superlikesUsed?: number;
  onboardingComplete?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

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

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firestore is not configured. Fill EXPO_PUBLIC_FIREBASE_* values in .env.");
  }

  return db;
}

async function getVerifiedProClaim(uid: string) {
  const currentUser = auth?.currentUser;
  if (!currentUser || currentUser.uid !== uid) return false;

  const token = await currentUser.getIdTokenResult();
  const entitlements = token.claims.activeEntitlements;
  return Array.isArray(entitlements) && entitlements.includes("Sparknew Pro");
}

export async function syncPublicUserProfile(uid: string, verifiedIsPro?: boolean) {
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
    profile.privateProfile !== true &&
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
  await setDoc(publicProfileRef, {
    uid,
    firstName: profile.firstName,
    lastName: profile.lastName,
    profileNameMode: profile.profileNameMode ?? "realName",
    nickname: profile.nickname ?? "",
    intent: profile.intent,
    ageBand: profile.ageBand ?? null,
    age: profile.age ?? null,
    interests: profile.interests,
    photoUrls: profile.photoUrls ?? [],
    mainPhotoUrl: profile.mainPhotoUrl ?? null,
    city: profile.city ?? "",
    country: profile.country ?? "",
    location: getApproximatePublicLocation(profile.location),
    isPro: claimIsPro,
    isTestProfile: existingData.isTestProfile === true,
    createdAt: existingPublic.exists() ? existingData.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function upsertUserProfile(profile: UserProfileDocument) {
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
  requireCommonInterests: boolean;
  proOnly: boolean;
};

export async function updateUserDiscoveryPreferences(uid: string, preferences: DiscoveryPreferencesDocument) {
  const currentDb = requireDb();

  await setDoc(
    doc(currentDb, "users", uid),
    { ...preferences, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function recordUserLogin(params: {
  uid: string;
  email: string | null;
  displayName: string | null;
  authProvider: "email" | "google" | "apple" | "demo";
  fallbackFirstName?: string;
  fallbackLastName?: string;
}) {
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

export async function getPublicProfile(uid: string) {
  const currentDb = requireDb();
  const snapshot = await getDoc(doc(currentDb, "publicProfiles", uid));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserProfileDocument & { id: string }) : null;
}

export async function requestAccountDeletionAndDeleteProfile(params: {
  uid: string;
  reason?: string;
}) {
  const currentDb = requireDb();
  const deletionRef = doc(currentDb, "accountDeletions", params.uid);
  const profileRef = doc(currentDb, "users", params.uid);
  const privateProfileRef = doc(currentDb, "privateProfiles", params.uid);
  const publicProfileRef = doc(currentDb, "publicProfiles", params.uid);

  await setDoc(
    deletionRef,
    {
      uid: params.uid,
      reason: params.reason ?? "in-app-delete-account",
      status: "requested",
      requestedAt: serverTimestamp()
    }
  );
  const [blocksSnapshot, outgoingSwipes, incomingSwipes, matchesSnapshot] = await Promise.all([
    getDocs(collection(currentDb, "users", params.uid, "blocks")),
    getDocs(query(collection(currentDb, "swipes"), where("fromUid", "==", params.uid))),
    getDocs(query(collection(currentDb, "swipes"), where("toProfileKey", "==", params.uid))),
    getDocs(query(collection(currentDb, "matches"), where("memberUids", "array-contains", params.uid)))
  ]);

  const messageSnapshots = await Promise.all(
    matchesSnapshot.docs.map((matchDocument) => getDocs(collection(currentDb, "messages", matchDocument.id, "items")))
  );
  const swipeDocuments = Array.from(
    new Map([...outgoingSwipes.docs, ...incomingSwipes.docs].map((item) => [item.id, item])).values()
  );

  await Promise.all(
    messageSnapshots.flatMap((snapshot) => snapshot.docs.map((item) => deleteDoc(item.ref)))
  );
  await Promise.all([
    ...matchesSnapshot.docs.map((item) => deleteDoc(item.ref)),
    ...blocksSnapshot.docs.map((item) => deleteDoc(item.ref)),
    ...swipeDocuments.map((item) => deleteDoc(item.ref))
  ]);


  await Promise.all([deleteDoc(publicProfileRef), deleteDoc(profileRef), deleteDoc(privateProfileRef)]);
}
export async function findTestProfiles() {
  const currentDb = requireDb();
  const snapshot = await getDocs(
    query(collection(currentDb, "publicProfiles"), where("isTestProfile", "==", true), limit(10))
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as UserProfileDocument) }));
}

export async function findProfilesByInterest(interests: string[]) {
  const currentDb = requireDb();
  if (interests.length === 0) {
    return [];
  }

  const profilesQuery = query(
    collection(currentDb, "publicProfiles"),
    where("interests", "array-contains-any", interests.slice(0, 10)),
    limit(25)
  );

  const snapshot = await getDocs(profilesQuery);
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

export async function createReport(params: {
  reporterUid: string;
  targetUid: string;
  reason: string;
  context?: string;
}) {
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
  resetAtMs?: number;
}) {
  const currentDb = requireDb();
  const swipeRef = doc(currentDb, "swipes", params.swipeId);

  const swipeData = {
    fromUid: params.fromUid,
    toProfileKey: params.toProfileKey,
    direction: params.direction,
    status: params.direction === "pass" ? "passed" : "liked",
    matchScore: params.matchScore ?? null,
    resetAt: params.resetAtMs ? new Date(params.resetAtMs) : null,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  };

  if (params.direction === "superlike") {
    const accountRef = doc(currentDb, "users", params.fromUid);
    const superlikesRemaining = await runTransaction(currentDb, async (transaction) => {
      const accountSnapshot = await transaction.get(accountRef);
      if (!accountSnapshot.exists()) {
        throw new Error("Nie znaleziono konta użytkownika.");
      }

      const account = accountSnapshot.data();
      const now = new Date();
      const currentPeriod = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
      const used = account.superlikePeriod === currentPeriod && typeof account.superlikesUsed === "number"
        ? account.superlikesUsed
        : 0;
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

    return { id: swipeRef.id, superlikesRemaining };
  }

  await setDoc(swipeRef, swipeData, { merge: true });
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
  const currentDb = requireDb();
  const snapshot = await getDocs(
    query(collection(currentDb, "swipes"), where("fromUid", "==", fromUid), limit(250))
  );

  const now = Date.now();
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      const resetAtMs = typeof data.resetAt?.toMillis === "function" ? data.resetAt.toMillis() : null;
      return { id: item.id, ...data, resetAtMs } as {
        id: string;
        fromUid: string;
        toProfileKey: string;
        status: "liked" | "passed";
        direction: "pass" | "like" | "superlike";
        resetAtMs: number | null;
      };
    })
    .filter((item) => item.resetAtMs === null || item.resetAtMs > now);
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

export async function createMatchThread(params: {
  matchId: string;
  memberUids: string[];
  createdByUid: string;
  source: "mutual-like" | "premium-request";
  introMessage?: string;
  resetAtMs?: number;
}) {
  const currentDb = requireDb();
  const matchRef = doc(currentDb, "matches", params.matchId);

  await setDoc(
    matchRef,
    {
      memberUids: params.memberUids,
      createdByUid: params.createdByUid,
      source: params.source,
      introMessage: params.introMessage?.trim() ?? null,
      status: params.source === "premium-request" ? "requested" : "matched",
      resetAt: params.resetAtMs ? new Date(params.resetAtMs) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return matchRef.id;
}

export async function sendChatMessage(params: {
  threadId: string;
  senderUid: string;
  text: string;
}) {
  const currentDb = requireDb();
  const messageRef = doc(collection(currentDb, "messages", params.threadId, "items"));

  await setDoc(messageRef, {
    senderUid: params.senderUid,
    text: params.text.trim(),
    createdAt: serverTimestamp()
  });

  return messageRef.id;
}


export type RealtimeChatThread = {
  id: string;
  memberUids: string[];
  createdByUid: string;
  status: "matched" | "requested";
  introMessage?: string;
  messages: Array<{ id: string; senderUid: string; text: string; createdAtMs: number | null }>;
};

export function observeUserChats(uid: string, onChange: (threads: RealtimeChatThread[]) => void, onError?: (error: Error) => void) {
  const currentDb = requireDb();
  const threadDocuments = new Map<string, Omit<RealtimeChatThread, "messages">>();
  const threadMessages = new Map<string, RealtimeChatThread["messages"]>();
  const messageUnsubscribers = new Map<string, () => void>();
  const emit = () => onChange(Array.from(threadDocuments.values()).map((thread) => ({ ...thread, messages: threadMessages.get(thread.id) ?? [] })));

  const unsubscribeMatches = onSnapshot(
    query(collection(currentDb, "matches"), where("memberUids", "array-contains", uid), limit(100)),
    (snapshot) => {
      const activeIds = new Set<string>();
      snapshot.docs.forEach((item) => {
        const data = item.data();
        const resetAtMs = typeof data.resetAt?.toMillis === "function" ? data.resetAt.toMillis() : null;
        if ((resetAtMs !== null && resetAtMs <= Date.now()) || (data.status !== "matched" && data.status !== "requested")) return;
        activeIds.add(item.id);
        threadDocuments.set(item.id, { id: item.id, memberUids: Array.isArray(data.memberUids) ? data.memberUids : [], createdByUid: String(data.createdByUid ?? ""), status: data.status, introMessage: typeof data.introMessage === "string" ? data.introMessage : undefined });
        if (!messageUnsubscribers.has(item.id)) {
          messageUnsubscribers.set(item.id, onSnapshot(
            query(collection(currentDb, "messages", item.id, "items"), orderBy("createdAt", "desc"), limit(100)),
            (messageSnapshot) => {
              threadMessages.set(item.id, messageSnapshot.docs.map((messageItem) => { const message = messageItem.data(); return { id: messageItem.id, senderUid: String(message.senderUid ?? ""), text: String(message.text ?? ""), createdAtMs: typeof message.createdAt?.toMillis === "function" ? message.createdAt.toMillis() : null }; }).reverse());
              emit();
            },
            (error) => onError?.(error)
          ));
        }
      });
      Array.from(threadDocuments.keys()).forEach((threadId) => { if (activeIds.has(threadId)) return; threadDocuments.delete(threadId); threadMessages.delete(threadId); messageUnsubscribers.get(threadId)?.(); messageUnsubscribers.delete(threadId); });
      emit();
    },
    (error) => onError?.(error)
  );
  return () => { unsubscribeMatches(); messageUnsubscribers.forEach((unsubscribe) => unsubscribe()); };
}

export function observeBlockedProfileKeys(uid: string, onChange: (profileKeys: string[]) => void, onError?: (error: Error) => void) {
  const currentDb = requireDb();
  return onSnapshot(collection(currentDb, "users", uid, "blocks"), (snapshot) => onChange(snapshot.docs.map((item) => String(item.data().blockedUid ?? item.id))), (error) => onError?.(error));
}

export async function acceptChatRequest(threadId: string, uid: string) {
  await updateDoc(doc(requireDb(), "matches", threadId), { status: "matched", acceptedByUid: uid, updatedAt: serverTimestamp() });
}

export async function rejectChatRequest(threadId: string, uid: string) {
  await updateDoc(doc(requireDb(), "matches", threadId), { status: "rejected", rejectedByUid: uid, updatedAt: serverTimestamp() });
}

export async function blockUser(params: { blockerUid: string; blockedUid: string; threadId?: string }) {
  const currentDb = requireDb();
  await setDoc(doc(currentDb, "users", params.blockerUid, "blocks", params.blockedUid), { blockedUid: params.blockedUid, createdAt: serverTimestamp() });
  if (params.threadId) await updateDoc(doc(currentDb, "matches", params.threadId), { status: "blocked", blockedByUid: params.blockerUid, updatedAt: serverTimestamp() });
}
