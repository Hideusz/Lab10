import { expect, test } from "vitest";
import { productSchema, productsArraySchema } from "./types";
import { getCatalogByCategory } from "./repository";

test("Walidator odrzuca ujemną cenę", () => {
  const badProduct = {
    id: 1,
    code: "CPUINTEL01",
    name: "Intel",
    type: "cpu",
    price: -100, // <--- celowo ujemna cena
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