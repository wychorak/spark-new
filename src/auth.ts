import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  User
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";

export type AppAuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

function requireAuth() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error("Firebase is not configured. Fill EXPO_PUBLIC_FIREBASE_* values in .env.");
  }

  return auth;
}

export function mapFirebaseUser(user: User): AppAuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL
  };
}

export function observeAuthState(callback: (user: AppAuthUser | null) => void) {
  const currentAuth = requireAuth();
  return onAuthStateChanged(currentAuth, (user) => callback(user ? mapFirebaseUser(user) : null));
}

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const currentAuth = requireAuth();
  const credential = await createUserWithEmailAndPassword(currentAuth, params.email, params.password);
  const displayName = `${params.firstName} ${params.lastName}`.trim();

  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }

  return mapFirebaseUser(credential.user);
}

export async function signInWithEmail(email: string, password: string) {
  const currentAuth = requireAuth();
  const credential = await signInWithEmailAndPassword(currentAuth, email, password);
  return mapFirebaseUser(credential.user);
}
export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    throw new Error("Podaj prawidłowy adres email.");
  }
  await sendPasswordResetEmail(requireAuth(), normalizedEmail);
}

export async function signInWithGoogleIdToken(idToken: string) {
  const currentAuth = requireAuth();
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(currentAuth, credential);
  return mapFirebaseUser(result.user);
}
export async function signInWithAppleIdToken(idToken: string, rawNonce: string) {
  const currentAuth = requireAuth();
  const provider = new OAuthProvider("apple.com");
  const credential = provider.credential({ idToken, rawNonce });
  const result = await signInWithCredential(currentAuth, credential);
  return mapFirebaseUser(result.user);
}

export async function signOutUser() {
  const currentAuth = requireAuth();
  await signOut(currentAuth);
}

export async function ensureRecentLoginForAccountDeletion() {
  const currentUser = requireAuth().currentUser;
  if (!currentUser) {
    throw new Error("Brak zalogowanego użytkownika.");
  }

  const token = await currentUser.getIdTokenResult();
  const authenticatedAt = Date.parse(token.authTime);
  const fourMinutes = 4 * 60 * 1000;
  if (!Number.isFinite(authenticatedAt) || Date.now() - authenticatedAt > fourMinutes) {
    throw new Error("Ze względów bezpieczeństwa wyloguj się, zaloguj ponownie i wtedy usuń konto.");
  }
}
export async function deleteCurrentUserAccount() {
  const currentAuth = requireAuth();
  const currentUser = currentAuth.currentUser;

  if (!currentUser) {
    throw new Error("No authenticated user to delete.");
  }

  try {
    await deleteUser(currentUser);
  } catch (error: any) {
    if (error?.code === "auth/requires-recent-login") {
      throw new Error("Zaloguj się ponownie i spróbuj usunąć konto jeszcze raz.");
    }

    throw error;
  }
}
