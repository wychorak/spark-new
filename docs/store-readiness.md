# Store Readiness Notes

## Current App Scope

- Expo / React Native app for iOS and Android.
- Core prototype screens: onboarding, discovery, premium discovery, matches, messages, profile, safety center.
- Firebase project, native app registrations, Firebase Auth providers, Firestore database, Firestore rules, and app-side Auth/Firestore wiring are in place.
- Production moderation queue, analytics, push, and final store metadata are not implemented yet.
- RevenueCat premium gating and AdMob banner/interstitial integration are wired. iOS and Android AdMob production IDs are configured.
- Foreground location permission and approximate card distance calculation are wired in the app.

## App Store / Google Play Must-Haves Before Submission

- Privacy policy URL in store metadata and inside the app. App now has configurable legal links via `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`, and `EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL`; hosted Vercel URLs are configured for review.
- Terms/community guidelines URL inside the app.
- 18+ gate retained before discovery features.
- In-app report/block flows and delete-account flow are wired. Delete-account removes Firebase Auth + main `users/{uid}` profile and writes `accountDeletions/{uid}`; final backend retention cleanup for chats/reports still needs admin processing.
- User-generated content moderation plan: automated detection, user reports, reviewer/admin workflow, and response SLA.
- Demo account for review if login becomes required.
- No external payment links for digital premium features. Use StoreKit / Play Billing for subscriptions.
- App Privacy / Data Safety forms mapped to actual data collection.
- Remaining AdMob production IDs, consent flow validation, and store privacy declarations before showing real ads broadly.
- Location privacy notice and geospatial backend filtering before using real user distance in production discovery.

## Backend Contracts / Firebase Work Still To Add

- Add final Android SHA-1/SHA-256 certificate fingerprints to Firebase and refresh `google-services.json`.
- RevenueCat public SDK key is configured. Verify offerings, products, entitlement, and paywall in RevenueCat before release.
- Validate AdMob production serving after app approval and keep test devices configured during development.
- Store only the minimum location precision needed for distance-based discovery and avoid exposing exact coordinates to other users.
- Add EU/UK consent flow before personalized ads.
- Add admin retention cleanup for old chats, reports, and deletion requests after in-app account deletion.
- Hosted community guidelines, terms, and privacy policy URLs are configured in `.env`.
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
