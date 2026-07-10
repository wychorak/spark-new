import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

export type UserProfileDocument = {
  uid: string;
  firstName: string;
  lastName: string;
  profileNameMode?: "realName" | "nickname";
  nickname?: string;
  email: string | null;
  displayName?: string | null;
  intent: string;
  ageBand?: "18+" | "under18" | null;
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
  requireCommonInterests?: boolean;
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
  onboardingComplete?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firestore is not configured. Fill EXPO_PUBLIC_FIREBASE_* values in .env.");
  }

  return db;
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
}

export async function recordUserLogin(params: {
  uid: string;
  email: string | null;
  displayName: string | null;
  authProvider: "email" | "google" | "demo";
  fallbackFirstName?: string;
  fallbackLastName?: string;
}) {
  const currentDb = requireDb();
  const profileRef = doc(currentDb, "users", params.uid);
  const existing = await getDoc(profileRef);
  const nameParts = (params.displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = params.fallbackFirstName || nameParts[0] || "Tester";
  const lastName = params.fallbackLastName || nameParts.slice(1).join(" ") || "Spark";

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

export async function requestAccountDeletionAndDeleteProfile(params: {
  uid: string;
  email: string | null;
  reason?: string;
}) {
  const currentDb = requireDb();
  const deletionRef = doc(currentDb, "accountDeletions", params.uid);
  const profileRef = doc(currentDb, "users", params.uid);
  const privateProfileRef = doc(currentDb, "privateProfiles", params.uid);

  await setDoc(
    deletionRef,
    {
      uid: params.uid,
      email: params.email,
      reason: params.reason ?? "in-app-delete-account",
      status: "requested",
      requestedAt: serverTimestamp()
    },
    { merge: true }
  );

  await Promise.all([deleteDoc(profileRef), deleteDoc(privateProfileRef)]);
}

export async function findProfilesByInterest(interests: string[]) {
  const currentDb = requireDb();
  if (interests.length === 0) {
    return [];
  }

  const profilesQuery = query(
    collection(currentDb, "users"),
    where("interests", "array-contains-any", interests.slice(0, 10)),
    where("privateProfile", "==", false),
    limit(25)
  );

  const snapshot = await getDocs(profilesQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
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
}) {
  const currentDb = requireDb();
  const swipeRef = doc(currentDb, "swipes", params.swipeId);

  await setDoc(
    swipeRef,
    {
      fromUid: params.fromUid,
      toProfileKey: params.toProfileKey,
      direction: params.direction,
      status: params.direction === "pass" ? "passed" : "liked",
      matchScore: params.matchScore ?? null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );

  return swipeRef.id;
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

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as {
    id: string;
    fromUid: string;
    toProfileKey: string;
    status: "liked" | "passed";
    direction: "pass" | "like" | "superlike";
  }));
}

export async function findMatchThreadsForUser(uid: string) {
  const currentDb = requireDb();
  const snapshot = await getDocs(
    query(collection(currentDb, "matches"), where("memberUids", "array-contains", uid), limit(100))
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as {
    id: string;
    memberUids: string[];
    status: "matched" | "requested";
  }));
}

export async function createMatchThread(params: {
  matchId: string;
  memberUids: string[];
  createdByUid: string;
  source: "mutual-like" | "premium-request";
}) {
  const currentDb = requireDb();
  const matchRef = doc(currentDb, "matches", params.matchId);

  await setDoc(
    matchRef,
    {
      memberUids: params.memberUids,
      createdByUid: params.createdByUid,
      source: params.source,
      status: params.source === "premium-request" ? "requested" : "matched",
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

export async function createChatRequest(params: {
  requestId: string;
  fromUid: string;
  toProfileKey: string;
  introMessage: string;
}) {
  const currentDb = requireDb();
  const requestRef = doc(currentDb, "chatRequests", params.requestId);

  await setDoc(
    requestRef,
    {
      fromUid: params.fromUid,
      toProfileKey: params.toProfileKey,
      introMessage: params.introMessage.trim(),
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return requestRef.id;
}

export async function blockUser(params: { blockerUid: string; blockedUid: string }) {
  const currentDb = requireDb();
  const blockRef = doc(currentDb, "users", params.blockerUid, "blocks", params.blockedUid);

  await setDoc(blockRef, {
    blockedUid: params.blockedUid,
    createdAt: serverTimestamp()
  });
}
