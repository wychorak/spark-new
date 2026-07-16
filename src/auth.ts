import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  User
} from "firebase/auth";
import { auth, firebaseAuthRestConfig, isFirebaseConfigured } from "./firebase";

export type AppAuthUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
};

function requireAuth() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error("Firebase is not configured. Fill EXPO_PUBLIC_FIREBASE_* values in .env.");
  }

  return auth;
}

function getFirebaseAuthErrorMessage(error: unknown, fallback: string) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Konto z tym adresem email ju\u017c istnieje.",
    "auth/invalid-credential": "Nieprawid\u0142owy email lub has\u0142o.",
    "auth/invalid-email": "Podaj prawid\u0142owy adres email.",
    "auth/network-request-failed": "Brak po\u0142\u0105czenia z internetem. Spr\u00f3buj ponownie.",
    "auth/too-many-requests": "Zbyt wiele pr\u00f3b. Odczekaj chwil\u0119 i spr\u00f3buj ponownie.",
    "auth/user-disabled": "To konto zosta\u0142o wy\u0142\u0105czone.",
    "auth/weak-password": "Has\u0142o jest zbyt s\u0142abe. U\u017cyj co najmniej 8 znak\u00f3w."
  };

  return messages[code] ?? fallback;
}
export function mapFirebaseUser(user: User): AppAuthUser {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
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
  try {
    const currentAuth = requireAuth();
    const credential = await createUserWithEmailAndPassword(currentAuth, params.email, params.password);
    const displayName = (params.firstName + " " + params.lastName).trim();

    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    return mapFirebaseUser(credential.user);
  } catch (error) {
    throw new Error(getFirebaseAuthErrorMessage(error, "Nie uda\u0142o si\u0119 utworzy\u0107 konta."));
  }
}
export async function signInWithEmail(email: string, password: string) {
  try {
    const currentAuth = requireAuth();
    const credential = await signInWithEmailAndPassword(currentAuth, email, password);
    return mapFirebaseUser(credential.user);
  } catch (error) {
    throw new Error(getFirebaseAuthErrorMessage(error, "Nie uda\u0142o si\u0119 zalogowa\u0107."));
  }
}
export async function signInWithGoogleIdToken(idToken: string) {
  const currentAuth = requireAuth();
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(currentAuth, credential);
  return mapFirebaseUser(result.user);
}

export async function signInWithAppleIdToken(params: {
  idToken: string;
  rawNonce: string;
  displayName?: string;
}) {
  try {
    const currentAuth = requireAuth();
    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({
      idToken: params.idToken,
      rawNonce: params.rawNonce
    });
    const result = await signInWithCredential(currentAuth, credential);

    if (params.displayName && !result.user.displayName) {
      await updateProfile(result.user, { displayName: params.displayName });
    }

    return mapFirebaseUser(result.user);
  } catch (error) {
    throw new Error(getFirebaseAuthErrorMessage(error, "Nie uda\u0142o si\u0119 zalogowa\u0107 przez Apple."));
  }
}

export function currentUserUsesAppleSignIn() {
  return Boolean(requireAuth().currentUser?.providerData.some((provider) => provider.providerId === "apple.com"));
}

export async function reauthenticateAndRevokeApple(params: {
  idToken: string;
  rawNonce: string;
  authorizationCode: string;
}) {
  const currentAuth = requireAuth();
  const currentUser = currentAuth.currentUser;
  if (!currentUser) throw new Error("Brak zalogowanego u\u017cytkownika.");

  const provider = new OAuthProvider("apple.com");
  const credential = provider.credential({
    idToken: params.idToken,
    rawNonce: params.rawNonce
  });
  await reauthenticateWithCredential(currentUser, credential);

  const firebaseIdToken = await currentUser.getIdToken(true);
  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=" +
      encodeURIComponent(firebaseAuthRestConfig.apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "apple.com",
        tokenType: "CODE",
        token: params.authorizationCode,
        idToken: firebaseIdToken,
        redirectUri: "https://" + firebaseAuthRestConfig.authDomain + "/__/auth/handler"
      })
    }
  );

  if (!response.ok) {
    throw new Error("Nie uda\u0142o si\u0119 uniewa\u017cni\u0107 dost\u0119pu Apple. Spr\u00f3buj ponownie.");
  }
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    throw new Error("Podaj prawid\u0142owy adres email.");
  }

  try {
    await sendPasswordResetEmail(requireAuth(), normalizedEmail);
  } catch (error) {
    throw new Error(getFirebaseAuthErrorMessage(error, "Nie uda\u0142o si\u0119 wys\u0142a\u0107 linku resetuj\u0105cego."));
  }
}
export async function signOutUser() {
  const currentAuth = requireAuth();
  await signOut(currentAuth);
}

export async function getRevenueCatEntitlements(forceRefresh = false) {
  const currentUser = requireAuth().currentUser;
  if (!currentUser) {
    return [];
  }

  const token = await currentUser.getIdTokenResult(forceRefresh);
  const entitlements = token.claims.activeEntitlements;

  return Array.isArray(entitlements)
    ? entitlements.filter((value): value is string => typeof value === "string")
    : [];
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
