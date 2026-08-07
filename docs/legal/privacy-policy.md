# Polityka prywatności Spark — wersja przedprodukcyjna

Ostatnia aktualizacja: 7 sierpnia 2026 r.

> Dokument opisuje zamierzone przepływy danych wersji kandydującej. Przed publikacją wymaga uzupełnienia pełnej tożsamości administratora, podstaw prawnych, okresów retencji i przeglądu prawnego.

## Jakie dane przetwarzamy

- konto i logowanie: e-mail, identyfikator Firebase, dostawca logowania, sesja i dane techniczne logowania
- profil: imię, nazwisko lub pseudonim, data urodzenia, wyliczony wiek, zdjęcia, opis, zainteresowania i preferencje
- odkrywanie: miasto, kraj i lokalizacja zaokrąglona przed publikacją do około 1 km
- aktywność: polubienia, pominięcia, matche, wiadomości, blokady, zgłoszenia i ustawienia powiadomień
- zakupy i reklamy: identyfikator klienta RevenueCat, status uprawnienia oraz dane przetwarzane przez sklep i Google Mobile Ads
- urządzenie: token powiadomień push, platforma i minimalne dane potrzebne do dostarczenia powiadomień

## Cele i podstawy prawne

Dane mają służyć do utworzenia konta, prezentowania profili, dopasowań, rozmów, obsługi Spark Pro, bezpieczeństwa, moderacji i wymaganych rozliczeń. Operator musi przed uruchomieniem wskazać i opublikować właściwą podstawę prawną dla każdego celu. Zgoda, gdy jest używana, musi być dobrowolna, odrębna i możliwa do wycofania.

## Analityka i reklamy

W bieżącym kliencie Analytics i Crashlytics są wyłączone i nie identyfikują użytkownika. Remote Config pobiera ustawienia wydania bez przypisywania UID. Google Mobile Ads uruchamia się po procedurze UMP i żąda reklam niepersonalizowanych; dostawca może nadal przetwarzać adres IP, identyfikatory urządzenia, dane reklamowe, diagnostyczne i wydajnościowe zgodnie ze swoimi zasadami.

## Dostawcy i transfery

Planowani dostawcy obejmują Firebase/Google Cloud, Expo, Apple, Google, RevenueCat, Google Mobile Ads, Codemagic i hosting stron prawnych. Przed produkcją należy opublikować listę procesorów, podpisać wymagane umowy, wskazać regiony danych i zabezpieczenia transferów międzynarodowych.

## Usunięcie konta i retencja

Usunięcie konta uruchamia funkcję serwerową, która usuwa konto Firebase Auth, profil, zdjęcia, wiadomości, matche, swipy, blokady, wyświetlenia profilu, tokeny urządzeń i kopie danych RevenueCat przechowywane w Firestore. Chronione zgłoszenia bezpieczeństwa oraz wymagane zapisy rozliczeniowe mogą być zachowane przez ograniczony okres. Dokładne okresy, wygasanie kopii zapasowych i procedura weryfikacji usunięcia są blokadami przed produkcją.

## Prawa użytkownika

Użytkownik może usunąć konto w aplikacji. Produkcja musi również zapewnić zweryfikowaną obsługę dostępu, korekty, ograniczenia, sprzeciwu, przenoszenia danych i skargi do organu nadzorczego w wymaganych terminach.

## Kontakt

Kontakt prototypu: sparkapp@gmail.com. Przed publikacją należy zastąpić go pełnymi danymi administratora oraz adresem do spraw prywatności.
