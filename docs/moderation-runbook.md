# Moderacja Spark

## Codzienna obsługa zgłoszeń

1. Otwórz Firebase Console projektu `spark-70b03` i przejdź do Firestore Database.
2. W kolekcji `reports` filtruj dokumenty z `status == open`.
3. Sprawdź `targetUid`, `reason`, `context` oraz powiązane dokumenty w `publicProfiles`, `matches` i `messages`.
4. Zapisz decyzję w zgłoszeniu: `status` (`resolved` albo `dismissed`), `reviewedAt`, `reviewedBy` i krótki `resolution`.
5. Zgłoszenia przemocy, gróźb, seksualizacji osób nieletnich lub bezpośredniego zagrożenia eskaluj natychmiast; nie czekaj na zwykły przegląd.

## Zawieszenie profilu

1. W `users/{targetUid}` ustaw `moderationStatus` na `suspended`.
2. Usuń `publicProfiles/{targetUid}`. Aplikacja nie opublikuje go ponownie, dopóki status pozostaje zawieszony.
3. W aktywnych dokumentach `matches` tej osoby ustaw `status` na `blocked`, gdy wymaga tego bezpieczeństwo rozmów.
4. Udokumentuj podstawę i datę decyzji w zgłoszeniu. Nie zapisuj dodatkowych danych wrażliwych bez potrzeby.

## Przywrócenie profilu

1. Po pozytywnym odwołaniu ustaw `users/{targetUid}.moderationStatus` na `active`.
2. Użytkownik opublikuje profil ponownie przy następnym logowaniu lub zapisie profilu.
3. Zmień zgłoszenie na `resolved` i zapisz uzasadnienie.

## Czas reakcji

- Bezpośrednie zagrożenie: natychmiast.
- Nękanie, podszywanie się, treści seksualne i spam: do 24 godzin.
- Pozostałe zgłoszenia: do 72 godzin.

Dostęp do Firebase Console powinny mieć wyłącznie osoby odpowiedzialne za moderację, z włączonym uwierzytelnianiem dwuskładnikowym.
