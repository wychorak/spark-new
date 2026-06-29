# Firebase Setup

Firebase project requested by the user: `271339297035`.

Resolved project ID: `spark-70b03`.

## Completed

- Firebase CLI access confirmed for `spark-70b03`.
- Firestore database created: `projects/spark-70b03/databases/(default)`.
- Firestore location: `eur3`.
- Firestore rules and indexes deployed from this repo.
- iOS app registered:
  - Bundle ID: `com.sparknew.connect`
  - App ID: `1:271339297035:ios:99de5bc38d0c7cb6272a0e`
  - Config file: `GoogleService-Info.plist`
- Android app registered:
  - Package: `com.sparknew.connect`
  - App ID: `1:271339297035:android:b7875d3c221ee666272a0e`
  - Config file: `google-services.json`
- Web app registered for Expo/Firebase JS SDK:
  - App ID: `1:271339297035:web:cdb95d58b3e84a44272a0e`
- `.firebaserc`, `app.json`, `.env.example`, Firebase SDK config, and Firestore helpers are wired to the project.
- Firebase Auth providers enabled through Firebase CLI deploy:
  - Email/password
  - Google Sign-In

## Google OAuth Client IDs

Current client IDs:

```powershell
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=271339297035-q7oggbponrnmb8fakreca7nk8p33lg8q.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=271339297035-320oq6h9pcmdn5kk75k5fg8igo9ht0h0.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=271339297035-q7oggbponrnmb8fakreca7nk8p33lg8q.apps.googleusercontent.com
```

`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is intentionally blank until the Android debug/release SHA-1 or SHA-256 certificate fingerprint is added to the Firebase Android app. After adding the SHA fingerprint, refresh `google-services.json` and copy the generated Android OAuth client ID here.

## App Environment

The repo includes `.env.example` with public Firebase client config for `spark-70b03`. The local `.env` file is ignored by Git and should contain the same Firebase values plus Google OAuth client IDs.

Firebase web/mobile API keys are public client identifiers, not server secrets. Firestore access is protected by `firestore.rules`, not by hiding these keys.

## Firestore

This repo includes:

- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`
- `.firebaserc`

Deploy rules, indexes, and Auth providers:

```powershell
npx firebase-tools deploy --only auth --project spark-70b03
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project spark-70b03
```

## Collections

- `users/{uid}`: profile, intent, interests, socials, premium plan, visibility.
- `users/{uid}/blocks/{blockedUid}`: block list scoped to owner.
- `reports/{reportId}`: moderation reports, create-only from signed-in users.
- `matches/{matchId}`: match metadata.
- `messages/{threadId}/items/{messageId}`: messages scoped to match members.

## Test Account

The login screen includes a test account button:

```powershell
Email: tester@spark.app
Password: sparkdemo
```

Pressing it signs in with Firebase Auth or creates the account if it does not exist yet. The app also seeds a local demo match and a pending premium chat request so the Matches and Messages tabs can be tested immediately.

## Current Code Integration

- `src/firebase.ts`: Firebase app, Auth, Firestore initialization from `EXPO_PUBLIC_*`.
- `src/auth.ts`: email/password signup, email/password login, Google Firebase credential login.
- `src/firestore.ts`: login recording, profile upsert, interest search, report, block helpers.
- `src/google-sign-in.ts`: Google client ID config.
- `App.tsx`: Auth UI calls Firebase helpers, records every email/Google/demo login in `users/{uid}`, and saves full profile data to Firestore after onboarding.
