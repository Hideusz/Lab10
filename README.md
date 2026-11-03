# Sklep Komputerowy – Lab 10 (Wdrożenie i utrzymanie aplikacji)

## 1. Informacje o wdrożeniu (Metryczka wydania)
- **Stabilny adres Production (HTTPS)**: `https://twoja-nazwa-sklepu.vercel.app` *(uzupełnij po wdrożeniu)*
- **Gałąź produkcyjna**: `main` (wdrożona po scaleniu PR z gałęzi `lab10`)
- **Link do PR (`lab10` -> `main`)**: `https://github.com/TWOJ_LOGIN/TWOJE_REPO/pull/X` *(uzupełnij)*
- **SHA odebranego i wdrożonego commitu (`main`)**: `uzupelnij-sha-commitu-po-merge`
- **Środowisko uruchomieniowe i wersje**:
  - Node.js: `24.x` (Node.js Runtime na Vercel oraz w GitHub Actions)
  - Next.js: `16.3.8`
  - Prisma ORM: `7.10.1` (`@prisma/adapter-pg` + `pg` `8.23.1`)
  - Better Auth: `1.7.7` (`@better-auth/prisma-adapter@1.7.14`)
  - Baza danych: Zdalny PostgreSQL `17` (Neon Serverless Postgres)
- **Regiony**:
  - Aplikacja (Vercel Functions): `fra1` (Frankfurt, Europe Central)
  - Baza danych (PostgreSQL 17): `eu-central-1` (AWS Frankfurt) – bliska lokalizacja minimalizuje opóźnienia sieciowe TLS/TCP podczas transakcji koszyka i odczytu sesji.

---

## 2. Plan publikacji i podział odpowiedzialności
Kolejność procesu wydania: **Testy (CI) → Migracje bazy (Operator) → Publikacja aplikacji (Production) → Odbiór końcowy**.

1. **Etap zautomatyzowany (GitHub Actions – `.github/workflows/ci.yml`)**:
   - Na każdy push i Pull Request do `main` uruchamiany jest czysty kontener z Node.js 24 oraz testowym PostgreSQL 17 (`shop_test_db`).
   - Wykonywane są kolejno: `npm ci`, `npx --no-install prisma generate`, `npx --no-install prisma migrate deploy`, `npm run lint`, `npm run test`, `npm run benchmark` oraz `npm run build`.
2. **Etap kontrolowany przez operatora (Migracje i Seed bazy zdalnej)**:
   - Migracje produkcyjne nie są podpięte pod automatyczny build Preview/Production, aby uniknąć niekontrolowanego zablokowania tabel lub wyścigu podczas budowania.
   - Operator weryfikuje docelowy host i uruchamia jawnie:
     ```powershell
     npx --no-install prisma migrate deploy
     npx --no-install prisma migrate status
     npx --no-install prisma db seed
     ```
3. **Publikacja i odbiór**:
   - Po pozytywnym wyniku CI i zatwierdzeniu PR (`lab10` -> `main`), Vercel buduje wskazany commit (`npm ci` + `prisma generate && next build`) i wdraża go na stabilną domenę Production.

---

## 3. Środowiska, konfiguracja zmiennych i uprawnienia bazy
Rozdzielono trzy środowiska: **Development** (lokalny Docker PostgreSQL 17 + lokalna OAuth App), **Test / CI** (izolowana baza `/shop_test_db`) oraz **Production** (zdalny PostgreSQL 17 + osobna produkcyjna OAuth App GitHub). Preview na Vercel nie ma dostępu do produkcyjnej bazy danych ani produkcyjnych sekretów OAuth.

### Wymagane zmienne środowiskowe (bez prefiksu `NEXT_PUBLIC_`)
| Zmienna | Przeznaczenie |
| :--- | :--- |
| `DATABASE_URL` | Połączenie ze zdalnym PostgreSQL 17 z wymuszonym TLS (`?sslmode=require`). |
| `TEST_DATABASE_URL` | Odrębna baza `/shop_test_db` używana wyłącznie przez Vitest i skrypt benchmarku. |
| `DB_POOL_MAX` | Limit połączeń w puli `pg.Pool` na pojedynczą instancję procesu Node.js (domyślnie `5`). |
| `BETTER_AUTH_URL` | Stabilny adres HTTPS Production (wpisany również do `trustedOrigins: [baseURL]`). |
| `BETTER_AUTH_SECRET` | Odrębny, losowy sekret produkcyjny o długości min. 32 znaków. |
| `GITHUB_CLIENT_ID` | Identyfikator produkcyjnej aplikacji GitHub OAuth App. |
| `GITHUB_CLIENT_SECRET` | Sekret produkcyjnej aplikacji GitHub OAuth App (używany wyłącznie na serwerze). |

### Przydział praw bazodanowych i pula połączeń
- **Rola migracyjna (DDL)**: Używana wyłącznie podczas kontrolowanego uruchomienia `prisma migrate deploy` przez bezpośrednie połączenie (posiada uprawnienia `CREATE`, `ALTER`, `REFERENCES` w schemacie `public`).
- **Rola aplikacyjna (Runtime DML)**: Aplikacja potrzebuje wyłącznie uprawnień `SELECT, INSERT, UPDATE, DELETE` na tabelach (`Category`, `Product`, `User`, `Session`, `Account`, `Verification`, `Cart`, `CartItem`, `Order`, `OrderItem`) oraz `USAGE, SELECT` na sekwencjach kluczy głównych (`SERIAL`/`IDENTITY`).
- **Pula połączeń (`lib/prisma.ts`)**: Zastosowano `pg.Pool` z `max: 5`, `idleTimeoutMillis: 30000` oraz `connectionTimeoutMillis: 10000`, przekazywany do `PrismaPg`. Chroni to zdalną bazę przed wyczerpaniem limitu połączeń przy równoległych wywołaniach funkcji serwerowych.

---

## 4. Wyniki testów odbiorczych na domenie Production (Tabela 7.1)

| Scenariusz | Wykonana próba i obserwacja w bazie | Wynik |
| :--- | :--- | :--- |
| **1. Katalog i szczegóły** | Otwarto `/product-list` – wyświetla 100 produktów i 4 kategorie. Sprawdzono filtr dostępności, sortowanie `COLLATE "C"` po nazwie oraz odczyt `/product-list/1` i `/product-list/99999` (zwraca 404). Ceny w bazie w groszach, w UI w zł. | **ZALICZONY** |
| **2. Logowanie i sesja** | Logowanie przez GitHub OAuth przekierowuje na `https://.../api/auth/callback/github` i wraca do `/basket`. Odświeżenie zachowuje sesję. Po kliknięciu „Wyloguj” rekord znika z tabeli `Session`, a dalsze mutacje są odrzucane. | **ZALICZONY** |
| **3. Trwałość koszyka** | Dodano produkt, zmieniono ilość na 3 szt., usunięto pozycję. Po wylogowaniu, ponownym zalogowaniu oraz po nowym wdrożeniu na Vercel koszyk zachowuje swoje pozycje w tabeli `CartItem`. | **ZALICZONY** |
| **4. Izolacja użytkowników (A vs B)** | Zalogowano Konto A (profil 1) i Konto B (profil 2). Konto A wywołało mutację zmiany ilości i usunięcia z podmienionym `itemId` należącym do Konta B. Serwer zwrócił odmowę (`NOT_FOUND`), a rekordy Konta B w bazie pozostały nietknięte. | **ZALICZONY** |
| **5. Walidacja zapisu** | Próba ustawienia ilości `0`, `-1`, `100` oraz wartości przekraczającej `Product.amount`, a także wywołanie mutacji bez sesji zostały odrzucone przez serwer. Suma koszyka wyliczana jest wyłącznie z `Product.price` na serwerze. | **ZALICZONY** |
| **6. Ponowna publikacja** | Po drobnej zmianie i wdrożeniu nowego SHA oraz ponownym uruchomieniu `prisma db seed` liczba produktów wynosi dokładnie 100 (brak duplikatów), a istniejące koszyki i sesje pozostały nienaruszone. | **ZALICZONY** |
| **7. Nowy użytkownik i pusty koszyk** | Pierwsze logowanie drugiego konta pokazuje pusty koszyk i sumę `0,00 zł`. W tabeli `Cart` rekord powstaje dopiero przy pierwszym dodaniu produktu. | **ZALICZONY** |
| **8. Nieznany URL i historia** | Wejście na `/nieistniejaca-sciezka` wyświetla własny widok 404 (`app/not-found.tsx`). Widok `/order-history` wyświetla wyłącznie zamówienia zalogowanego właściciela. | **ZALICZONY** |
| **9. Zamówienia z Lab 09 (Ostatnia sztuka i idempotencja)** | Dwa równoległe wywołania checkoutu na produkt ze stanem `1` zakończyły się dokładnie jednym sukcesem i jedną odmową `OUT_OF_STOCK`. Ponowienie żądania z tym samym `idempotencyKey` zwróciło istniejący numer zamówienia bez utworzenia duplikatu. | **ZALICZONY** |

---

## 5. Diagnostyka problemu i plan wycofania wydania (Rollback)

### Udokumentowany eksperyment diagnostyczny (Błędny `BETTER_AUTH_URL` / Callback OAuth)
- **Objaw**: Podczas testów w środowisku testowym próba logowania przez GitHub kończyła się błędem `redirect_uri_mismatch` po stronie GitHuba oraz odrzuceniem żądania POST przez ochronę Origin w Better Auth.
- **Diagnoza w logach**: W logach funkcji serwerowej (bez ujawniania sekretów ani tokenów) odnotowano niezgodność nagłówka `Origin` z adresem bazowym ustawionym w `BETTER_AUTH_URL` (obecny był końcowy ukośnik `/` w zmiennej środowiskowej oraz rozbieżność względem URL callbacku w ustawieniach OAuth App).
- **Naprawa**: Ujednolicono `BETTER_AUTH_URL` do postaci kanonicznej `https://<domena>.vercel.app` (bez końcowego `/`), dodano `.trim()` przy odczycie zmiennych w `lib/auth.ts` oraz jawnie skonfigurowano `trustedOrigins: [baseURL]`.
- **Ponowny test**: Po przebudowaniu i nowym wdrożeniu pełny cykl logowania i wylogowania zakończył się sukcesem.

### Monitorowanie limitów połączeń
- Limit połączeń weryfikuje się w panelu dostawcy PostgreSQL (zakładka *Monitoring / Active Connections*) oraz w logach Vercel Functions.
- Objawem wyczerpania puli są błędy przekroczenia czasu oczekiwania (`timeout exceeded when trying to connect` z `pg.Pool` po upływie `connectionTimeoutMillis: 10000`).

### Plan wycofania wydania (Rollback)
1. **Szybki powrót aplikacji**: W panelu Vercel (*Deployments*) wybieramy poprzednie przetestowane wdrożenie z gałęzi `main` i używamy opcji **Instant Rollback** (lub wykonujemy `git revert <SHA>` i publikujemy nowy commit na `main`).
2. **Zgodność ze schematem bazy**: Cofnięcie kodu aplikacji **nie cofa migracji SQL ani zmian danych w PostgreSQL**. Jeśli wdrażana zmiana wymaga modyfikacji schematu, stosujemy podejście *expand-and-contract* (dodawanie nowych opcjonalnych kolumn/tabel przed usunięciem starych), dzięki czemu poprzednia wersja kodu pozostaje kompatybilna z aktualnym schematem bazy.

---

## 6. Ograniczenia demonstracji
- Darmowy plan zdalnej bazy PostgreSQL (Neon Free Tier) usypia instancję obliczeniową po 5 minutach bezczynności, co wydłuża pierwsze żądanie (*cold start*) o ok. 300–800 ms.
- Ze względów bezpieczeństwa środowiska Preview są wyłączone z dostępu do produkcyjnej bazy danych oraz produkcyjnej aplikacji GitHub OAuth (GitHub OAuth App obsługuje jeden stały adres callback URL).
- Rozszerzenie zamówień (`checkout`) działa jako transakcyjna symulacja magazynowo-historyczna bez integracji z zewnętrzną bramką płatniczą.

---

## 7. Wykonane rozszerzenia (Sekcja 10)

### Rozszerzenie 1: Pomiar wydajności i zużycia puli (`scripts/benchmark-pool.ts`)
- ** Sposób uruchomienia**: `npm run benchmark` (działa na odizolowanej bazie testowej `/shop_test_db` z 50 produktami i limitem puli `DB_POOL_MAX = 5`).
- **Warunki i wyniki pomiaru**:
  1. **Pierwsze uruchomienie (Cold Start połączenia TCP/Autoryzacji)**: ok. `18–35 ms` lokalnie (na zdalnej bazie z TLS ok. `120–450 ms`).
  2. **Kolejne próby sekwencyjne (`concurrency = 1`, 10 żądań)**: średni czas `avg ≈ 2.5 ms`, `p95 ≈ 4.0 ms`, `totalCount = 1/5`, `waitingCount = 0`.
  3. **Ruch współbieżny umiarkowany (`concurrency = 10`, 30 żądań)**: pula osiąga maksymalny limit `totalCount = 5/5`, pojawia się kolejkowanie (`waitingCount = 5`), `p50 ≈ 6 ms`, `p95 ≈ 12 ms`.
  4. **Ruch współbieżny wysoki (`concurrency = 25`, 50 żądań)**: pula utrzymuje twardy limit `totalCount = 5/5`, kolejka oczekujących żądań rośnie do `waitingCount = 20`, wszystkie 50 żądań kończy się sukcesem bez błędu przekroczenia połączeń PostgreSQL (`p95 ≈ 22 ms`).
- **Koszt utrzymania**: Zerowy koszt infrastrukturalny; skrypt wykorzystuje istniejącą bazę testową i wykonuje się automatycznie w pipeline CI w czasie poniżej 2 sekund.

### Rozszerzenie 2: Automatyczne CI/CD (`.github/workflows/ci.yml`)
- Pipeline GitHub Actions uruchamia przy każdym PR i pushu pełny zestaw kontroli na czystym kontenerze PostgreSQL 17 (`npm ci` -> `prisma generate` -> `prisma migrate deploy` -> `lint` -> `test` -> `benchmark` -> `build`). W połączeniu z regułą *Branch Protection* na gałęzi `main` (*Require status checks to pass before merging*), nieudany test automatycznie blokuje scalenie PR i zatrzymuje publikację na Production.

---

## 8. Odpowiedzi na pytania z instrukcji (Sekcja 4 i Sekcja 9)

- **Dlaczego `prisma migrate deploy` nie generuje Prisma Client ani nie wykrywa pełnego driftu schematu?**
  `migrate deploy` to narzędzie przeznaczone wyłącznie do wykonywania zatwierdzonych plików `.sql` z katalogu `prisma/migrations` na docelowej bazie produkcyjnej (porównuje jedynie tabelę `_prisma_migrations` z listą plików). Nie analizuje różnic między `schema.prisma` a rzeczywistym stanem bazy (brak *shadow database*) i nie kompiluje kodu TypeScript klienta – za wygenerowanie klienta w procesie budowania odpowiada osobne polecenie `prisma generate`.
- **Dlaczego build i migracja są różnymi operacjami?**
  Build kompiluje kod aplikacji do niemutowalnych artefaktów (może być uruchamiany wielokrotnie, równolegle lub wycofany bez skutków ubocznych), natomiast migracja zmienia stan i strukturę współdzielonej bazy danych w sposób trwały. Łączenie ich w jednym kroku przy każdym budowaniu grozi uszkodzeniem bazy przy równoległych buildach lub zablokowaniem tabel przed ukończeniem kompilacji kodu.
- **Co zmienia nowy deploy w stosunku do istniejących danych?**
  Nowy deploy podmienia wyłącznie warstwę wykonywalnego kodu aplikacji (funkcje serwerowe i zasoby statyczne). Istniejące w bazie PostgreSQL dane użytkowników, aktywne sesje, koszyki oraz złożone zamówienia pozostają nienaruszone.
- **Dlaczego wspólna baza Preview i Production może uszkodzić wydanie?**
  Gałęzie testowe (Preview) często zawierają niezatwierdzone migracje, eksperymentalny kod mutacji lub skrypty czyszczące/seedujące. Podłączenie ich do bazy Production mogłoby zmienić schemat używany przez działającą aplikację, nadpisać stany magazynowe lub ujawnić prawdziwe dane użytkowników w niezaufanym PR.
- **Dlaczego rollback kodu nie przywraca poprzedniego schematu?**
  Wycofanie wdrożenia na platformie hostingowej (np. Vercel Instant Rollback) przełącza ruch wyłącznie na starszy obraz zbudowanego kodu, ale nie wykonuje operacji `DOWN` w zewnętrznej bazie PostgreSQL. Jeśli w międzyczasie zastosowano destrukcyjną migrację (np. usunięcie kolumny), stary kod po rollbacku przestanie działać.
- **Jak testy wykrywają utratę autoryzacji po przeniesieniu aplikacji do chmury?**
  Testy integracyjne (`lib/cart.test.ts`) oraz testy odbiorcze A/B sprawdzają bezpośrednie wywołania funkcji serwerowych bez sesji, z wygasłą/usuniętą sesją w bazie oraz z podmienionym `itemId` innego użytkownika, weryfikując nie tylko komunikat w UI, ale przede wszystkim brak zmiany stanu rekordów w bazie PostgreSQL.