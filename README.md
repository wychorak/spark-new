# Spark - Cherry Blossom Connect

Expo / React Native prototype for an App Store and Google Play ready dating and friend-discovery app.\n\n## Product Status\n\nThe app now includes a mobile-native prototype with 18+ onboarding, discovery, Premium discovery controls, matches, messages, profile settings, and a Safety Center scaffold for report/block/account deletion flows.


## Frontend Flow

Current front-end coverage:

- Login and registration screen with first name, last name, email, password, and social login placeholders.
- 18+ onboarding with relationship intent and selectable interest badges.
- Discovery cards with full names, age, city, social links, premium badges, and interests.
- Matches grid, messages list, profile editor, premium plans, and Safety Center.
- Profile settings include push notifications, private profile toggle, premium entry, safety entry, social links, and editable interest badges.
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

The `stitch-reference` directory contains downloaded PNG and HTML references from the Stitch project `Cherry Blossom Connect`.

See docs/store-readiness.md for review and launch requirements still needed before submitting to App Store Connect or Google Play Console.


