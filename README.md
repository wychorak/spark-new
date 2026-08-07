# Spark

> Status: mobile release candidate. The code-level release audit passes; TestFlight/device QA and store-console tasks remain.

Spark is an Expo/React Native social discovery app designed around private account data, safe public profiles, matching and realtime conversation.

## Product scope

- email, Google and Apple authentication with persistent sessions
- 18+ onboarding, 4:5 photos, interests and discovery preferences
- separate private account documents and public profiles
- card feed, filters, swipes, mutual matches and realtime chat
- chat requests, reporting, blocking, moderation and account deletion
- Spark Pro subscriptions through RevenueCat
- AdMob monetization with European UMP consent handling

## Stack

Expo, React Native, TypeScript, Firebase Auth/Firestore/Storage, RevenueCat, AdMob, EAS/Codemagic and Vercel for public legal pages.

## Local development

```bash
npm ci
npm run typecheck
npm run web
```

The web preview is useful for logic and responsive-layout checks, but it does not validate native photo picking, gestures, StoreKit, RevenueCat, AdMob or iOS safe areas.

## Verification and release status

`npm run release:check` passes type checking and 164 automated release assertions. Final release still requires a fresh TestFlight build, physical-device authentication and purchase tests, approved IAP products, App Store privacy metadata, final screenshots and an assigned moderation operator.

See [`docs/store-readiness.md`](docs/store-readiness.md), [`docs/firebase-setup.md`](docs/firebase-setup.md) and [`docs/revenuecat-monetization.md`](docs/revenuecat-monetization.md).
