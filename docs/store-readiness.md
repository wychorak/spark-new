# Store Readiness Notes

## Current App Scope

- Expo / React Native app for iOS and Android.
- Core prototype screens: onboarding, discovery, premium discovery, matches, messages, profile, safety center.
- Firebase project, native app registrations, Firebase Auth providers, Firestore database, Firestore rules, and app-side Auth/Firestore wiring are in place.
- Production moderation queue, analytics, push, and final store metadata are not implemented yet.
- RevenueCat premium gating and AdMob banner/interstitial integration are wired with test keys/IDs.
- Foreground location permission and approximate card distance calculation are wired in the app.

## App Store / Google Play Must-Haves Before Submission

- Privacy policy URL in store metadata and inside the app.
- Terms/community guidelines URL inside the app.
- 18+ gate retained before discovery features.
- In-app report and block flows connected to Firestore helpers; delete-account still needs Firebase Auth deletion plus retention policy.
- User-generated content moderation plan: automated detection, user reports, reviewer/admin workflow, and response SLA.
- Demo account for review if login becomes required.
- No external payment links for digital premium features. Use StoreKit / Play Billing for subscriptions.
- App Privacy / Data Safety forms mapped to actual data collection.
- AdMob production IDs, consent flow, and store privacy declarations before showing real ads.
- Location privacy notice and geospatial backend filtering before using real user distance in production discovery.

## Backend Contracts / Firebase Work Still To Add

- Add final Android SHA-1/SHA-256 certificate fingerprints to Firebase and refresh `google-services.json`.
- Replace RevenueCat test key with platform public SDK keys after real App Store / Play Store apps are configured.
- Replace AdMob test IDs with approved production app/ad unit IDs.
- Store only the minimum location precision needed for distance-based discovery and avoid exposing exact coordinates to other users.
- Add EU/UK consent flow before personalized ads.
- Add account deletion with confirmation and Firestore cleanup/retention behavior.
- Add hosted community guidelines and privacy policy URLs.
- Add optional profile verification flow.
- Add reviewer/admin workflow for `reports`.

## Launch Build Commands

```powershell
npx expo install --check
npm run typecheck
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest build -p android --profile production
```

Do not run `npm audit fix --force` unless Expo confirms the resulting SDK downgrade is acceptable.
