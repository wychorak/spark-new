import { getApp, getApps, initializeApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth, initializeAuth, type Persistence } from "firebase/auth";
import * as FirebaseAuthReactNative from "@firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseDefaults = {
  apiKey: "AIzaSyDs-x9Fe_m11y3uYKEKCSc0t2VCnTtBDbU",
  authDomain: "spark-70b03.firebaseapp.com",
  projectId: "spark-70b03",
  storageBucket: "spark-70b03.firebasestorage.app",
  messagingSenderId: "271339297035",
  appId: "1:271339297035:web:cdb95d58b3e84a44272a0e",
  iosBundleId: "com.sparknew.connect",
  androidPackageName: "com.sparknew.connect"
};

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || firebaseDefaults.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseDefaults.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || firebaseDefaults.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseDefaults.storageBucket,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseDefaults.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || firebaseDefaults.appId,
  iosBundleId: process.env.EXPO_PUBLIC_FIREBASE_IOS_BUNDLE_ID || firebaseDefaults.iosBundleId,
  androidPackageName: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_PACKAGE_NAME || firebaseDefaults.androidPackageName
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== "iosBundleId" && key !== "androidPackageName" && !value)
  .map(([key]) => key);

export const isFirebaseConfigured = missingConfig.length === 0;
export const firebaseConfigStatus = {
  missingConfig
};
export const firebaseAuthRestConfig = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain
};

export const firebaseApp = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

type ReactNativeAuthModule = {
  getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
};

function createAuth() {
  if (!firebaseApp) {
    return null;
  }

  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }

  try {
    const { getReactNativePersistence } = FirebaseAuthReactNative as unknown as ReactNativeAuthModule;
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;
