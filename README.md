# Sklep Komputerowy - Lab06

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