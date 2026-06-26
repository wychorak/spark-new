# Firebase Setup

Firebase project requested by the user: `271339297035`.

Current CLI status: the local Firebase account can authenticate, but does not have access to this project number. The command below currently fails with `403 The caller does not have permission`.

## Required Firebase Console Setup

1. Grant this Firebase CLI account access to project `271339297035`, or provide the real Firebase project ID for that project number.
2. In Firebase Console, enable Authentication providers:
   - Email/password
   - Google
3. Register an iOS app:

```powershell
npx firebase-tools apps:create IOS "Spark iOS" --bundle-id com.spark.cherryblossomconnect --project 271339297035
```

4. Get the iOS SDK config:

```powershell
npx firebase-tools apps:list --project 271339297035
npx firebase-tools apps:sdkconfig IOS <IOS_APP_ID> --project 271339297035
```

5. Register Android app too before Google Play builds:

```powershell
npx firebase-tools apps:create ANDROID "Spark Android" --package-name com.spark.cherryblossomconnect --project 271339297035
```

## App Environment

Copy `.env.example` to `.env` and fill:

```powershell
Copy-Item .env.example .env
```

Required client-side values:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

Firebase web/mobile API keys are public identifiers, not server secrets. Still, Firestore security depends on rules, not hidden API keys.

## Firestore

This repo includes:

- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`
- `.firebaserc`

After replacing `.firebaserc` with the real project ID:

```powershell
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

## Collections

- `users/{uid}`: profile, intent, interests, socials, premium plan, visibility.
- `users/{uid}/blocks/{blockedUid}`: block list scoped to owner.
- `reports/{reportId}`: moderation reports, create-only from signed-in users.
- `matches/{matchId}`: match metadata.
- `messages/{threadId}/items/{messageId}`: messages scoped to match members.

## Current Code Integration

- `src/firebase.ts`: Firebase app, Auth, Firestore initialization from `EXPO_PUBLIC_*`.
- `src/auth.ts`: email/password signup, email/password login, Google Firebase credential login.
- `src/firestore.ts`: profile upsert, interest search, report, block helpers.
- `src/google-sign-in.ts`: Google client ID config.
- `App.tsx`: Auth UI now calls Firebase helpers and saves profile data to Firestore after onboarding.
