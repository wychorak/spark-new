# RevenueCat and Ads Setup

Sparknew uses RevenueCat for premium access and AdMob ads for free users.

## Installed npm Packages

```powershell
npm install --save react-native-purchases react-native-purchases-ui
npm install --save react-native-google-mobile-ads
```

Installed versions:

- `react-native-purchases`
- `react-native-purchases-ui`
- `react-native-google-mobile-ads`

These native modules require an Expo development build. They will not work in Expo Go.

## Environment

```powershell
EXPO_PUBLIC_REVENUECAT_API_KEY=test_ZXrasnBoneOhTMZGyJXoPEEacNC
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=Sparknew Pro

EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-3940256099942544~3347511713
EXPO_PUBLIC_ADMOB_IOS_APP_ID=ca-app-pub-3940256099942544~1458002511
EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID=ca-app-pub-3940256099942544/6300978111
EXPO_PUBLIC_ADMOB_IOS_BANNER_ID=ca-app-pub-3940256099942544/2934735716
EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-3940256099942544/1033173712
EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID=ca-app-pub-3940256099942544/4411468910
```

The AdMob IDs above are Google test IDs. Replace them with production IDs only after AdMob approval and before store release.

Free users see a lightweight banner and a skippable interstitial/video-style ad after a randomized 5-10 profile swipes. `Sparknew Pro` hides all ads.

## RevenueCat Dashboard

Create one entitlement:

- Entitlement ID: `Sparknew Pro`

Create three products and attach them to that entitlement:

- `weekly`: subscription, one week
- `monthly`: subscription, one month
- `lifetime`: non-consumable lifetime unlock

Create an Offering, mark it current, and add packages that include those products. The app matches packages by package identifier, package type, or product identifier containing `weekly`, `monthly`, or `lifetime`.

Attach a RevenueCat Paywall to the current Offering. The app calls:

```ts
RevenueCatUI.presentPaywallIfNeeded({
  requiredEntitlementIdentifier: "Sparknew Pro",
  displayCloseButton: true
});
```

## Customer Center

Customer Center is useful once users can manage active subscriptions, restore purchases, request support, or cancel from inside the app. Configure it in the RevenueCat dashboard, then the app can open it from Premium and Profile:

```ts
RevenueCatUI.presentCustomerCenter();
```

If the user has no purchase history, Customer Center may show only restore/support states.

## App Code

- `src/revenuecat.ts`: SDK configure, user identity sync, customer info listener, entitlement checking, package purchases, restore, paywall, Customer Center.
- `src/ads.tsx`: AdMob banner, swipe interstitial ads for free users, and RevenueCat ad lifecycle tracking.
- `App.tsx`: Premium tab, gated Premium discovery mode, Profile subscription management row, ads hidden for `Sparknew Pro`, match-to-chat, and premium chat requests.

Core entitlement check:

```ts
customerInfo.entitlements.active["Sparknew Pro"] !== undefined
```

Manual purchase flow:

```ts
const result = await revenueCat.purchasePlan("monthly");
if (result.ok) {
  // customer info listener updates access
}
```

Restore flow:

```ts
const result = await revenueCat.restorePurchases();
```

## Best Practices

- Gate features on entitlement state, not product IDs.
- Keep `restorePurchases()` as a visible user action.
- Do not show purchase errors when `userCancelled` is true.
- Disable purchase buttons while a purchase is in progress.
- Keep interstitial frequency randomized and capped by swipe actions so ads monetize without interrupting every profile.
- Keep using AdMob test IDs until the production AdMob app and ad units are approved.
- Replace the single test RevenueCat key with platform-specific public SDK keys when the real App Store and Google Play apps are configured in RevenueCat.
- Never put RevenueCat secret API keys in the mobile app.

## Development Build

```powershell
npx expo prebuild
npx eas-cli@latest build -p ios --profile development
npx eas-cli@latest build -p android --profile development
npx expo start --dev-client
```

After changing `app.json` native plugin config, rebuild the dev client.
