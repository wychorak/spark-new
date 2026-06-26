# Store Readiness Notes

## Current App Scope

- Expo / React Native app for iOS and Android.
- Core prototype screens: onboarding, discovery, premium discovery, matches, messages, profile, safety center.
- Local mock data only. No production backend, auth, moderation queue, analytics, push, or payments yet.

## App Store / Google Play Must-Haves Before Submission

- Privacy policy URL in store metadata and inside the app.
- Terms/community guidelines URL inside the app.
- 18+ gate retained before discovery features.
- In-app report, block, and delete-account flows connected to backend APIs.
- User-generated content moderation plan: automated detection, user reports, reviewer/admin workflow, and response SLA.
- Demo account for review if login becomes required.
- No external payment links for digital premium features. Use StoreKit / Play Billing for subscriptions.
- App Privacy / Data Safety forms mapped to actual data collection.

## Backend Contracts To Add

- `POST /reports` for user/content reports.
- `POST /blocks` and `DELETE /blocks/:id`.
- `DELETE /account` with confirmation and retention policy.
- `GET /community-guidelines`.
- `GET /privacy-policy`.
- `POST /profile-verification`.

## Launch Build Commands

```powershell
npx expo install --check
npm run typecheck
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest build -p android --profile production
```

Do not run `npm audit fix --force` unless Expo confirms the resulting SDK downgrade is acceptable.
