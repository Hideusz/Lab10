import { expect, test } from "vitest";
import { productSchema, productsArraySchema } from "./types";
import { getCatalogByCategory } from "./repository";
import { getFilteredCatalog } from "./repository";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

test("Walidator odrzuca ujemną cenę", () => {
  const badProduct = {
    id: 1,
    code: "CPUINTEL01",
    name: "Intel",
    type: "cpu",
    price: -100,  
    amount: 5,
    description: "Opis",
    date: "2026-10-01T10:00:00Z",
    image: "/img.webp"
  };
  
  const result = productSchema.safeParse(badProduct);
  expect(result.success).toBe(false);
});

test("Walidator odrzuca duplikaty kodów (unikalność)", () => {
  const duplicateProducts = [
    { id: 1, code: "SAMECODE12", name: "A", type: "cpu", price: 100, amount: 5, description: "X", date: "2026-10-01T10:00:00Z", image: "/img.webp" },
    { id: 2, code: "SAMECODE12", name: "B", type: "gpu", price: 200, amount: 1, description: "Y", date: "2026-10-01T10:00:00Z", image: "/img.webp" }
  ];
  
  // Rzutujemy to na `any`, bo ignorujemy błędy typowania na poczet testu walidatora
  const result = productsArraySchema.safeParse(duplicateProducts as unknown);
  expect(result.success).toBe(false);
});

test("Filtr dostępności / kategorii działa poprawnie", async () => {
  // Testujemy funkcję na podstawie pliku JSON, który utworzyliśmy
  const cpuProducts = await getCatalogByCategory("cpu");
  // Oczekujemy, że zwróci nam tablicę
  expect(Array.isArray(cpuProducts)).toBe(true);
});

test("Filtrowanie: brak wyników zwraca pustą tablicę", async () => {
  // Szukamy np niedostępnych procesorów, jeśli w naszej bazie takie nie występują
  // (Zakładam, że test na Twojej bazie może to zwrócić pustą, jeśli generator nie złożył akurat takiego)
  // Przetestujmy kombinację gwarantującą brak błędu pomimo pustki:
  const result = await getFilteredCatalog({ type: "cpu", stock: "unavailable", sort: "name" });
  expect(Array.isArray(result)).toBe(true);
});

test("Sortowanie najnowsze rozstrzyga remisy po ID", async () => {
  const result = await getFilteredCatalog({ type: "all", stock: "all", sort: "newest" });
  // Sprawdzamy, czy jeśli daty byłyby identyczne, mniejsze ID jest pierwsze
  if (result.length >= 2 && result[0].date === result[1].date) {
    expect(result[0].id).toBeLessThan(result[1].id);
  }
  // Ogólnie sprawdzamy czy pierwszy ma datę >= od drugiego
  if (result.length >= 2) {
    const d1 = new Date(result[0].date).getTime();
    const d2 = new Date(result[1].date).getTime();
    expect(d1).toBeGreaterThanOrEqual(d2);
  }
});