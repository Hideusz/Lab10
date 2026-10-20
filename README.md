# Sklep Komputerowy - Lab07

## Środowisko i uruchomienie
- **Node.js**: 24 LTS
- **Next.js**: 16.3.8
- **Menadżer pakietów**: npm

Aby uruchomić aplikację lokalnie:
1. Zainstaluj zależności: `npm ci`
2. Uruchom serwer developerski: `npm run dev`
3. Wejdź na `http://localhost:3000`

## Pytania z instrukcji:

**1. Czym różnią się page.tsx i layout.tsx?**
`page.tsx` odpowiada za unikalną treść danej ścieżki (podstrony). `layout.tsx` to wspólny element otaczający strony (np. nagłówek, nawigacja), który nie przeładowuje się podczas przechodzenia między podstronami.

**2. Gdzie wykonuje się funkcja repozytorium?**
Wykonuje się wyłącznie na serwerze (wymusza to dopisek "server-only"). Do przeglądarki klienta trafia tylko wyrenderowany wynik HTML z danymi, a nie cały zasób JSON czy logika pobierania.

**3. Dlaczego import całego JSON do komponentu klienta zmienia architekturę?**
Powoduje to wysłanie całej bazy danych bezpośrednio do przeglądarki użytkownika. To zagrożenie bezpieczeństwa, marnowanie transferu i złamanie koncepcji renderowania po stronie serwera.

**4. Czy "use client" wyklucza początkowe renderowanie HTML na serwerze?**
Nie. Komponenty oznaczone jako "use client" również są wstępnie renderowane na serwerze w postaci czystego HTML, a dopiero potem "nawadniane" (hydratowane) po stronie przeglądarki, aby stać się interaktywnymi.

**5. Dlaczego brak funkcjonalności (placeholder koszyka) nie jest awarią?**
Ponieważ to pożądany, przewidziany na ten moment stan interfejsu użytkownika, a nie nieobsłużony wyjątek (błąd) przerywający działanie programu.

**6. Czy granica error.tsx przechwytuje błąd layoutu w tym samym segmencie?**
Nie. Granica `error.tsx` łapie błędy tylko w komponentach-dzieciach (stronach wewnątrz). Żeby złapać błąd głównego layoutu, potrzebny jest `global-error.tsx`.

**8. Rozszerzenie: Prerenderowanie szczegółów (generateStaticParams)**
Wykorzystano funkcję `generateStaticParams` do wygenerowania statycznego HTML podczas procesu `build` dla produktów o ID od 1 do 5. 
- **Wynik build:** W konsoli podczas budowania widać, że strony dla ID 1-5 zostały wygenerowane jako w pełni statyczne (kółko `○` / `●`).
- **Zachowanie poza zbiorem i `dynamicParams`:** dla identyfikatorów spoza listy `1–5` `dynamicParams = true` pozwala Next.js obsłużyć trasę dynamicznie. Po dodaniu bazy danych w Lab 08 odczyty muszą korzystać z aktualnego źródła danych.

## Rozszerzenie Lab 07: modal obrazu

### Jak działa routing

- Kliknięcie obrazu w katalogu lub na stronie produktu prowadzi do `/product-list/{id}/image` przez komponent `Link`.
- Przy nawigacji klientowej ścieżka jest przechwytywana przez `app/@modal/(.)product-list/[id]/image/page.tsx`. Slot `@modal` renderuje modal nad aktualną stroną, nie zmieniając jej kontekstu.
- Przy bezpośrednim wejściu lub odświeżeniu `/product-list/{id}/image` uruchamia się `app/product-list/[id]/image/page.tsx`, więc obraz jest wyświetlany jako pełna strona.
- `app/@modal/default.tsx` zwraca `null` dla nieaktywnego slotu; `app/@modal/page.tsx` oraz `app/@modal/[...catchAll]/page.tsx` czyszczą go podczas nawigacji klientowej na inne trasy. `app/default.tsx` określa fallback niejawnego slotu `children` wymagany dla nieodtwarzalnego stanu przy pełnym ładowaniu.

### Obsługa i dostępność

- Przycisk zamykania i klawisz Escape wywołują `router.back()`, co pozwala przywrócić poprzedni URL (w tym filtry katalogu). Kliknięcie przyciemnionego tła także zamyka modal.
- Modal korzysta z natywnego elementu `<dialog>` otwieranego metodą `showModal()`, co zapewnia semantykę okna modalnego i natywne ograniczenie fokusu. Fokus początkowy trafia na przycisk zamknięcia, a po zamknięciu jest przywracany do linku obrazu, o ile nadal istnieje w DOM.
- Osobny widok pełnoekranowy ma link powrotu do szczegółów produktu, więc nie wymaga historii przeglądarki, aby przejść z powrotem do sklepu.

### Scenariusze ręcznej weryfikacji

1. W katalogu kliknij zdjęcie. URL powinien kończyć się na `/product-list/{id}/image`, a zdjęcie ma otworzyć się nad katalogiem.
2. Zamknij przyciskiem, klawiszem Escape i kliknięciem tła. Sprawdź powrót do poprzedniego widoku oraz filtrów; fokus powinien wrócić na link zdjęcia.
3. Otwórz ten sam URL obrazu w nowej karcie lub odśwież stronę. Powinna pokazać się pełna strona obrazu z linkiem „Wróć do produktu”.
4. Otwórz modal, użyj przycisku Wstecz, a następnie Dalej w przeglądarce. Modal powinien się zamknąć i ponownie otworzyć zgodnie ze stanem historii.
5. Przejdź do innej trasy podczas otwartego modala. Slot `@modal` powinien się wyczyścić.

Skrypt `npm run lint` uruchamia ESLint bez wycofanego `next lint`.

## 7. Rozszerzenia Lab 08: Model koszyka oraz Historia zamówień

### 7.1. Model koszyka (`User`, `Cart`, `CartItem`)
- Przygotowano model `User` zgodny ze specyfikacją Better Auth (`id` typu `String`, `name`, unikalny `email`, `emailVerified`, opcjonalne `image`, `createdAt`, `updatedAt`) oraz zseedowano fikcyjne konto `jan.kowalski@example.com`.
- Model `Cart` posiada unikalny klucz `userId` (`@unique`), a `CartItem` wymusza unikalność pary `@@unique([cartId, productId])`.
- Usunięcie koszyka kaskadowo usuwa jego pozycje (`onDelete: Cascade`).
- W osobnej migracji SQL (`cart_and_orders`) dodano ograniczenie `CHECK ("quantity" BETWEEN 1 AND 99)`.

### 7.2. Historia zamówień (`Order`, `OrderItem`)
- Dodano modele `Order` (z unikalnym `orderNumber`, jawnym statusem enum `OrderStatus` i sumą `totalAmount` typu `BigInt` w groszach) oraz `OrderItem` (przechowujący snapshot z chwili zakupu: `productCode`, `productName`, `unitPrice` w groszach, dodatnią ilość `quantity` oraz iloczyn `lineTotal` typu `BigInt`).
- Relacja `OrderItem -> Product` jest opcjonalna z akcją `onDelete: SetNull`, dzięki czemu usunięcie produktu z katalogu nie usuwa historii zamówień, a jedynie zeruje referencję `productId` przy zachowaniu pełnej kopii danych produktu.
- W migracji SQL dodano więzy `CHECK` dla dodatniej ilości (`quantity > 0`), nieujemnej ceny jednostkowej (`unitPrice >= 0`) oraz zgodności `lineTotal = unitPrice * quantity`.
- Skrypt `prisma/seed.ts` tworzy cztery deterministyczne zamówienia (`ORD-2026-0001` .. `ORD-2026-0004`), a skrypt `npm run verify-orders` oraz testy integracyjne w `lib/repository.test.ts` potwierdzają, że zmiana aktualnej ceny produktu w tabeli `Product` nie zmienia wartości historycznych zamówień.
