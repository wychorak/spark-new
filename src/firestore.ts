import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
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
  email: string | null;
  intent: string;
  interests: string[];
  city?: string;
  socials?: Record<string, string>;
  premiumPlan?: string;
  privateProfile?: boolean;
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

export async function getUserProfile(uid: string) {
  const currentDb = requireDb();
  const snapshot = await getDoc(doc(currentDb, "users", uid));
  return snapshot.exists() ? (snapshot.data() as UserProfileDocument) : null;
}

export async function findProfilesByInterest(interests: string[]) {
  const currentDb = requireDb();
  if (interests.length === 0) {
    return [];
  }

  const profilesQuery = query(
    collection(currentDb, "users"),
    where("interests", "array-contains-any", interests.slice(0, 10)),
    orderBy("updatedAt", "desc"),
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

export async function blockUser(params: { blockerUid: string; blockedUid: string }) {
  const currentDb = requireDb();
  const blockRef = doc(currentDb, "users", params.blockerUid, "blocks", params.blockedUid);

  await setDoc(blockRef, {
    blockedUid: params.blockedUid,
    createdAt: serverTimestamp()
  });
}
