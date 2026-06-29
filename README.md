# Spark

Expo / React Native prototype for an App Store and Google Play ready dating and friend-discovery app.

## Product Status

The app includes a mobile-native prototype with login/registration, 18+ onboarding, selectable interest badges, discovery, Premium discovery controls, matches, messages, profile settings, and a Safety Center scaffold for report/block/account deletion flows.

## Frontend Flow

Current front-end coverage:

- Login and registration screen with first name, last name, email, password, and Firebase Auth wiring.
- Google Sign-In wiring through Expo AuthSession and Firebase credentials.
- 18+ onboarding with relationship intent and selectable interest badges.
- Discovery cards with full names, age, city, social links, premium badges, and interests.
- Matches grid, messages list, profile editor, premium plans, and Safety Center.
- Profile settings include push notifications, private profile toggle, premium entry, safety entry, social links, and editable interest badges.

## Firebase Status

Firebase is wired to project `spark-70b03` / number `271339297035`.

- iOS app registered: `com.spark.cherryblossomconnect`
- Android app registered: `com.spark.cherryblossomconnect`
- Web app registered for Expo/Firebase JS SDK config
- Firestore database created in `eur3`
- Firestore rules and indexes are deployable from this repo
- Firebase Auth providers enabled: Email/password and Google

Before production Android Google Sign-In, add the final debug/release SHA-1 or SHA-256 certificate fingerprints to the Firebase Android app and refresh `google-services.json`.

## Run

```powershell
npm install
npm run start
```

Scan the QR code with Expo Go, or run `npm run ios` / `npm run android`.

## Store Builds

```powershell
npm install -g eas-cli
eas login
npx eas-cli@latest init
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest build -p android --profile production
```

Before production submission, replace placeholders in `app.json` and `eas.json`:

- `extra.eas.projectId`
- `ios.bundleIdentifier`
- `android.package`
- `submit.production.ios.appleId`
- `submit.production.ios.ascAppId`
- `submit.production.android.serviceAccountKeyPath`

## Reference Assets

The `stitch-reference` directory contains downloaded PNG and HTML references from the original Stitch reference project.

See `docs/store-readiness.md` for review and launch requirements still needed before submitting to App Store Connect or Google Play Console.

See `docs/firebase-setup.md` for Firebase Auth, Google Sign-In, Firestore rules, and app registration steps.

See `docs/revenuecat-monetization.md` for RevenueCat subscriptions, Sparknew Pro entitlement gating, Customer Center, and AdMob setup.
