# Spark

Aplikacja Expo / React Native do poznawania nowych osób, przygotowywana do wydania w App Store.

## Zakres produktu

- Logowanie e-mail, Google i Apple z trwałą sesją.
- Onboarding 18+, zdjęcia 4:5, zainteresowania i preferencje odkrywania.
- Prywatny dokument konta oraz osobny, bezpieczny profil publiczny.
- Feed kart, filtry, swipe, wzajemne matche i realtime chat.
- Prośby o chat, zgłoszenia, blokowanie, moderacja i usuwanie konta.
- Spark Pro przez RevenueCat oraz reklamy AdMob z europejską zgodą UMP.
- Firebase `spark-70b03`, Firestore, Storage i produkcyjne reguły bezpieczeństwa.

## Praca lokalna

```powershell
npm ci
npm run typecheck
npm run web
```

Podgląd webowy służy do sprawdzania logiki i responsywności. Nie jest miarodajny dla safe area, natywnego wyboru zdjęć, gestów, StoreKit, RevenueCat ani AdMob. Expo Go nie obsługuje wszystkich modułów używanych przez Spark; finalne testy wykonuj na buildzie TestFlight z Codemagic.
## Store Builds

Produkcyjny build iOS powstaje w Codemagic z workflow `ios-testflight`:

```powershell
npm ci
npm run typecheck
npx expo export --platform ios
```

Identyfikatory aplikacji, Firebase, AdMob, RevenueCat oraz App Store Connect są skonfigurowane. Nie dodawaj Dev Clienta do zależności buildu App Store.
## Reference Assets

The `stitch-reference` directory contains downloaded PNG and HTML references from the original Stitch reference project.

See `docs/store-readiness.md` for review and launch requirements still needed before submitting to App Store Connect or Google Play Console.

See `docs/firebase-setup.md` for Firebase Auth, Google Sign-In, Firestore rules, and app registration steps.

See `docs/revenuecat-monetization.md` for RevenueCat subscriptions, Sparknew Pro entitlement gating, Customer Center, and AdMob setup.
