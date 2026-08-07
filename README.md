# Spark

> React Native social-discovery release candidate · 2026

Spark is an 18+ social-discovery app built around explicit profile visibility, mutual matching and safety controls. The repository contains the Expo client, Firebase Functions, Firestore/Storage rules and public legal pages.

## Product highlights

- email, Google and Apple authentication with persistent Firebase sessions
- self-declared 18+ onboarding, profile photos, interests and discovery preferences
- private account documents separated from signed-in-user public profiles
- paginated discovery, swipes, mutual matches, chat requests and realtime messaging
- reporting, blocking, moderation, account deletion and Apple token revocation
- Spark Pro subscriptions through RevenueCat
- non-personalized AdMob placements gated by Google's consent flow

## Architecture

| Area | Technology |
| --- | --- |
| Mobile | Expo, React Native, TypeScript |
| Backend | Firebase Auth, Firestore, Storage and Cloud Functions |
| Monetization | RevenueCat and Google Mobile Ads |
| Delivery | EAS, Codemagic and Vercel legal pages |

## Security and privacy

- Firestore rules separate private account data from discoverable profiles and protect premium/moderation fields.
- Chat writes, premium requests, moderation and account deletion use server-authoritative callable functions.
- Moderator and event-publishing access requires a Firebase `sparkAdmin` custom claim; email addresses do not grant privileges.
- RevenueCat entitlements are verified from trusted token claims before premium fields are accepted.
- Public coordinates are rounded to roughly 1 km before profile publication; exact birth date stays in a private document.
- Account deletion removes Auth, profile, match, message, swipe, block, view, purchase-mirror and Storage records while retaining protected reports where required for safety.
- Analytics and Crashlytics are not included in the release client until an explicit consent/opt-out flow exists. Remote Config does not identify the user.
- Demo credentials, service accounts, signing material and infrastructure state are excluded from version control.

Firebase mobile configuration, RevenueCat SDK keys and AdMob unit IDs are public client identifiers rather than server secrets. They still require console-side app restrictions, App Check, least-privilege IAM, quota monitoring and separate production/test projects. See [`docs/security.md`](docs/security.md) and [`docs/legal/privacy-policy.md`](docs/legal/privacy-policy.md).

## Local development

```bash
npm ci
npm run typecheck
npm run web
```

Copy `.env.example` to `.env` for local public configuration. Never put private keys or service-account credentials in an `EXPO_PUBLIC_*` variable because Expo embeds those values in the app bundle.

## Verification and release status

```bash
npm run release:check
npx expo-doctor
npm --prefix functions run build
npm audit --audit-level=high
```

The automated release audit covers configuration and code invariants, not penetration testing. Release still requires current Firestore/Storage deployment, App Check enforcement, TestFlight and physical-device QA, sandbox purchases, verified account deletion, moderation staffing and final App Store privacy metadata.
