import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  iosBundleId: process.env.EXPO_PUBLIC_FIREBASE_IOS_BUNDLE_ID,
  androidPackageName: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_PACKAGE_NAME
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== "iosBundleId" && key !== "androidPackageName" && !value)
  .map(([key]) => key);

export const isFirebaseConfigured = missingConfig.length === 0;
export const firebaseConfigStatus = {
  missingConfig
};

export const firebaseApp = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
