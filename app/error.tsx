"use client"; // To jest wymagane dla granic błędów

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset, 
}: {
  error: Error & { digest?: string };
  reset: () => void; 
}) {
  useEffect(() => {
    // Logowanie błędu do konsoli serwera/przeglądarki
    console.error("Wystąpił błąd:", error);
  }, [error]);

  return (
    <div>
      <h2>Ups! Coś poszło nie tak.</h2>
      {/* Pokazujemy bezpieczny komunikat bez ujawniania sekretów */}
      <p>Wystąpił nieoczekiwany problem z załadowaniem danych.</p>
      {/* Przycisk do ponowienia próby renderowania */}
      <button onClick={() => reset()}>Spróbuj ponownie</button>
    </div>
  );
}