# Gotowość do wydania Spark

Ostatni audyt kodu: 14 lipca 2026.

## Aktualizacja UX — 8 listopada 2026

- Poprawki z lokalnego `95be2a6` przeniesiono na nowszą linię `main` od `eab9f22`, zachowując jej logowanie natywne, telemetrię, backend, obecny wygląd Profilu oraz obsługę zgłoszeń wydarzeń.
- Wydarzenia mają zakładki Odkrywaj / Moje / Dodaj, wyszukiwanie bez polskich znaków, kalendarz i wybór godzin początku oraz końca. Zmiana początku przesuwa koniec o tę samą różnicę, zachowując czas trwania.
- Polska lista miejscowości działa offline i pozwala wpisać inną miejscowość. Miejsce i opis pozostają opcjonalne, zgodnie z aktualnym formatem katalogu.
- Szkic formularza nie znika po odświeżeniu katalogu, zmianie zakładki ani zamknięciu modalu. Jest przechowywany w pamięci sesji; wylogowanie i zamknięcie aplikacji go usuwają. Blokada ponownego wysłania trwa do zakończenia żądania, również po zamknięciu okna.
- Nowe zgłoszenia muszą zaczynać się w przyszłości, koniec musi następować po początku, a daty muszą mieścić się w 400 dniach. Edycja zgłoszenia przez administratora może zachować rozpoczęte wydarzenie, jeżeli jeszcze trwa. Godziny są prezentowane w strefie telefonu.
- Profil zachowuje nowy wygląd z GitHuba. Dodano rzeczywisty stan uzupełnienia karty, większe cele dotykowe wydarzeń i odporny na błędy zapis.
- Walidacja: `npm run typecheck`, `npm test` (5 testów logiki dat, miejscowości i zgodności katalogu), eksport iOS oraz interaktywny podgląd web 390×844 i 1280×900. Sprawdzono wybór Łodzi po wpisaniu `lodz`, kalendarz, zachowanie szkicu między zakładkami oraz błąd zapisu z udanym ponowieniem. Podgląd `?preview=events&theme=light` / `dark` jest dostępny wyłącznie w trybie developerskim web; `&failOnce` symuluje pierwszą nieudaną próbę zapisu, bez zapisu do Firebase.
- `npm run release:check` nadal zgłasza 5 z 164 sprawdzeń. Identyczny wynik potwierdzono na niezmienionym `origin/main` (`eab9f22`): reguły dotyczą starego układu reklam/viewportu oraz usuniętych nagłówków zainteresowań i wydarzeń. Nie zmieniano ich przy przenoszeniu UX; wymagają osobnego przeglądu zgodności z aktualnym produktem.
- Natywny wybór daty dodaje `@react-native-community/datetimepicker` 9.1.0. Potrzebny jest nowy build iOS i test na fizycznym iPhonie; sam eksport JS nie sprawdza natywnego kalendarza ani klawiatury.

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
