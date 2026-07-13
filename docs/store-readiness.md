# Gotowość do wydania Spark

Ostatni audyt kodu: 14 lipca 2026.

## Zaimplementowane i sprawdzone

- Firebase Auth: e-mail, Google, Apple, trwała sesja i reset hasła.
- Onboarding 18+: profil, data urodzenia, zdjęcia 4:5, zainteresowania i preferencje.
- Prywatne `users` i jawne, pozbawione e-maila `publicProfiles`.
- Upload i usuwanie zdjęć w Firebase Storage oraz ograniczenie pliku do 8 MB.
- Feed, filtry wieku/dystansu/zainteresowań, swipe, wzajemny match i animacje.
- Czat realtime, prośby o chat, blokowanie i zgłaszanie.
- Reguły blokujące sfałszowany match bez dwóch polubień.
- Usunięcie konta i danych użytkownika z zachowaniem wyłącznie minimalnych danych bezpieczeństwa i rozliczeń, gdy jest to wymagane.
- RevenueCat: identyfikacja UID, aktywne entitlementy, zakup, restore, paywall i Customer Center.
- AdMob z UMP/zgodą, reklamami niepersonalizowanymi i produkcyjnymi identyfikatorami.
- Publiczne strony: prywatność, regulamin i zasady społeczności na Vercel.
- Procedura moderacji: `docs/moderation-runbook.md` i chroniony `moderationStatus`.
- Natywna konfiguracja iOS bez Dev Launchera, lokalnej sieci, lokalizacji Always i wyjątków ATS.
- Manifest prywatności iOS z danymi profilu, przybliżoną lokalizacją, zdjęciami, wiadomościami i aktywnością w aplikacji; śledzenie wyłączone.

## Wymagane przed wysłaniem do App Review

1. Zbuduj nowy IPA w Codemagic z najnowszego `main` i zainstaluj go z TestFlight.
2. Na fizycznym iPhonie sprawdź: Apple login (także Ukryj mój e-mail), Google login, wybór zdjęcia, lokalizację, swipe, match, chat, blokadę, zgłoszenie i usunięcie konta.
3. W sandboxie Apple wykonaj zakup tygodniowy/miesięczny, restore oraz zakup lifetime. Potwierdź entitlement `Sparknew Pro` na stronie klienta RevenueCat.
4. Upewnij się, że wszystkie trzy produkty IAP są zatwierdzone lub dołączone do tej samej wersji aplikacji wysyłanej do review.
5. W App Store Connect uzupełnij App Privacy zgodnie z `ios.privacyManifests` w `app.json`. Uwzględnij również dane Google Mobile Ads: identyfikator urządzenia, dane reklamowe, interakcje, diagnostykę i wydajność; w obecnej konfiguracji nie deklarujemy śledzenia. Ustaw też kategorię wiekową 18+, dane kontaktowe review, konto demonstracyjne i notatki dla recenzenta.
6. Dodaj finalne zrzuty App Store wykonane z tego samego builda, który przejdzie TestFlight.
7. Wyznacz osobę sprawdzającą kolekcję `reports` zgodnie z runbookiem moderacji.

## Kontrole techniczne

```powershell
npm ci
npm run typecheck
npx expo-doctor
npx expo export --platform ios
npx firebase-tools deploy --only firestore:rules,storage --dry-run --project spark-70b03
```

Nie używaj `npm audit fix --force`, jeśli zmienia wersje wymagane przez aktualny Expo SDK.
