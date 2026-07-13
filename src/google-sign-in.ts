const defaultGoogleClientIds = {
  ios: "271339297035-320oq6h9pcmdn5kk75k5fg8igo9ht0h0.apps.googleusercontent.com",
  web: "271339297035-q7oggbponrnmb8fakreca7nk8p33lg8q.apps.googleusercontent.com"
};

export const googleClientIds = {
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || defaultGoogleClientIds.web,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || defaultGoogleClientIds.ios,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || defaultGoogleClientIds.web
};

export const isGoogleSignInConfigured = Boolean(
  googleClientIds.iosClientId || googleClientIds.androidClientId || googleClientIds.webClientId
);
