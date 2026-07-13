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
EXPO_PUBLIC_REVENUECAT_API_KEY=appl_ncfYcNBlFslQlMhPWGSaAfHHeaM
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=Sparknew Pro
EXPO_PUBLIC_REVENUECAT_WEEKLY_PRODUCT_ID=Sparkproweek
EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID=Sparkpromonth
EXPO_PUBLIC_REVENUECAT_LIFETIME_PRODUCT_ID=sparkprolifetime

EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-8263324816746737~5461920676
EXPO_PUBLIC_ADMOB_IOS_APP_ID=ca-app-pub-8263324816746737~3188934953
EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID=ca-app-pub-8263324816746737/1021936619
EXPO_PUBLIC_ADMOB_IOS_BANNER_ID=ca-app-pub-8263324816746737/9299047738
EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-8263324816746737/8708854948
EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID=ca-app-pub-8263324816746737/4491619788
```

The iOS and Android AdMob IDs above are production IDs from AdMob. New units can take up to an hour before they start serving ads.

Free users see a lightweight banner and a skippable interstitial/video-style ad after a randomized 5-10 profile swipes. `Sparknew Pro` hides all ads.

`Sparknew Pro` unlocks these user-facing features:

- See who swiped/liked your profile.
- Send one premium chat request to a profile before a mutual match; the other person must accept it.
- Show a Pro crown/badge next to the profile photo.
- Raise the profile photo limit from 3 to 15, with the first photo as the main 4:5 card image.
- Increase profile visibility in the discovery feed.

## RevenueCat Dashboard

Create one entitlement:

- Entitlement ID: `Sparknew Pro`

Create three products and attach them to that entitlement:

- `Sparkproweek`: one week auto-renewable subscription
- `Sparkpromonth`: one month auto-renewable subscription
- `sparkprolifetime`: non-consumable lifetime unlock

Important: App Store Connect products for premium access should not be `Consumable`. Weekly/monthly belong in Auto-Renewable Subscriptions. Lifetime should be a Non-Consumable in-app purchase. If the current drafts cannot change type, create new products with the correct types before connecting them in RevenueCat.

Create an Offering, mark it current, and add packages that include those products. The app maps plan IDs `weekly`, `monthly`, and `lifetime` to product IDs `Sparkproweek`, `Sparkpromonth`, and `sparkprolifetime`.

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
const result = await revenueCat.purchasePlan("monthly"); // maps to Sparkpromonth
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
- iOS and Android production AdMob IDs are configured. Keep test device IDs enabled during development, and only rely on production serving after AdMob approval.
- RevenueCat public SDK key is configured in env. Use only public mobile SDK keys in the app, never secret API keys.
- Never put RevenueCat secret API keys in the mobile app.

## Bezpieczna synchronizacja Pro z Firebase

Korona Pro, boost profilu, przychodzące polubienia i miesięczny limit SparkLike korzystają z claimu `activeEntitlements`. Claim ustawia oficjalne rozszerzenie RevenueCat dla Firebase; sam publiczny klucz SDK w aplikacji nie może bezpiecznie nadawać tych uprawnień.

Stan projektu sprawdzony 13 lipca 2026: rozszerzenie nie jest jeszcze zainstalowane w `spark-70b03`.

1. Otwórz instalator `revenuecat/firestore-revenuecat-purchases` dla projektu `spark-70b03`.
2. Ustaw kolekcję klientów na `revenuecat_customers`, a zdarzeń na `revenuecat_events`.
3. Włącz Firebase Authentication custom claims: `ENABLED`.
4. W RevenueCat przejdź do `Integrations > Firebase`, wygeneruj shared secret i wklej go podczas instalacji.
5. Po instalacji skopiuj Trigger URL z Firebase Functions do integracji Firebase w RevenueCat i zapisz.
6. Wyślij testowe zdarzenie, a następnie potwierdź, że token użytkownika zawiera `activeEntitlements: ["Sparknew Pro"]`.

Reguły Firestore pozwalają pokazać publiczny status Pro i listę przychodzących polubień tylko wtedy, gdy ten zweryfikowany claim istnieje. SparkLike jest liczony transakcyjnie w dokumencie użytkownika i resetuje się według miesiąca UTC.

## TestFlight Build

Natywne moduły RevenueCat i AdMob testuj w IPA z workflow Codemagic `ios-testflight`. Po każdej zmianie pluginów w `app.json` wykonaj nowy build; podgląd webowy i Expo Go nie potwierdzają zachowania StoreKit ani reklam iOS.
