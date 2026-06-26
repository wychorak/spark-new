# Store Readiness Notes

## Current App Scope

- Expo / React Native app for iOS and Android.
- Core prototype screens: onboarding, discovery, premium discovery, matches, messages, profile, safety center.
- Firebase project, native app registrations, Firebase Auth providers, Firestore database, Firestore rules, and app-side Auth/Firestore wiring are in place.
- Production moderation queue, analytics, push, subscriptions, and final store metadata are not implemented yet.

## App Store / Google Play Must-Haves Before Submission

- Privacy policy URL in store metadata and inside the app.
- Terms/community guidelines URL inside the app.
- 18+ gate retained before discovery features.
- In-app report and block flows connected to Firestore helpers; delete-account still needs Firebase Auth deletion plus retention policy.
- User-generated content moderation plan: automated detection, user reports, reviewer/admin workflow, and response SLA.
- Demo account for review if login becomes required.
- No external payment links for digital premium features. Use StoreKit / Play Billing for subscriptions.
- App Privacy / Data Safety forms mapped to actual data collection.

## Backend Contracts / Firebase Work Still To Add

- Add final Android SHA-1/SHA-256 certificate fingerprints to Firebase and refresh `google-services.json`.
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
