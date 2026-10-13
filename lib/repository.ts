import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Product, productsArraySchema } from "./types";

// Asynchroniczna funkcja - przygotowanie pod bazę z Lab08
async function loadProducts(): Promise<Product[]> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const filePath = path.join(process.cwd(), "data", "products.json");
  
  try {
    const fileContents = await fs.readFile(filePath, "utf8");
    const parsedJson = JSON.parse(fileContents);
    // Tutaj wykonujemy rzeczywistą walidację i rzutowanie
    const validatedProducts = productsArraySchema.parse(parsedJson);
    return validatedProducts;
  } catch (error) {
    console.error("Błąd wczytywania lub walidacji produktów z pliku", error);
    // Rzucamy wyjątek, jeśli wystąpi nieoczekiwana awaria,
    // po to, aby odpaliła się granica błędu error.tsx
    throw new Error("Nie można pobrać danych.");
  }
}

// Funkcja eksportująca katalog produktów - sortujemy na odłączonej kopii
export async function getCatalog(sortBy: "name" | "date" = "name", descending: boolean = false): Promise<Product[]> {
  const products = await loadProducts();
  
  // Klonujemy przed modyfikacją (nie mutujemy wejścia wg zaleceń)
  const sorted = [...products].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "name") {
      comparison = a.name.localeCompare(b.name, "pl"); // obsługa remisów (localeCompare)
    } else {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return descending ? -comparison : comparison;
  });
  return sorted;
}

// Ograniczenie wyniku do dostępnych lub niedostępnych produktów
export async function getCatalogByAvailability(isAvailable: boolean): Promise<Product[]> {
    const products = await loadProducts();
    return products.filter(p => isAvailable ? p.amount > 0 : p.amount === 0);
}

// Odczyt po kategorii
export async function getCatalogByCategory(type: "cpu" | "gpu" | "ram" | "disk"): Promise<Product[]> {
    const products = await loadProducts();
    return products.filter(p => p.type === type);
}

// Odczyt pojedynczego produktu wg id - zwracamy np null jeśli brak by sygnalizować brak produktu
export async function getProductById(id: number): Promise<Product | null> {
    const products = await loadProducts();
    const product = products.find(p => p.id === id);
    return product || null;
}
export type CatalogFilters = {
  type: "all" | "cpu" | "gpu" | "ram" | "disk";
  stock: "all" | "available" | "unavailable";
  sort: "name" | "newest";
};

export async function getFilteredCatalog(filters: CatalogFilters): Promise<Product[]> {
  const products = await loadProducts();
  
  // 1. Filtrowanie
  let filtered = products.filter(p => {
    const matchType = filters.type === "all" || p.type === filters.type;
    const matchStock = filters.stock === "all" 
      ? true 
      : filters.stock === "available" ? p.amount > 0 : p.amount === 0;
    
    return matchType && matchStock;
  });

  // 2. Sortowanie (nie mutujemy wejścia, 'filtered' to już nowa tablica z filter)
  filtered.sort((a, b) => {
    let diff = 0;
    if (filters.sort === "newest") {
      diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    } else {
      diff = a.name.localeCompare(b.name, "pl");
    }
    
    // Rozstrzyganie remisów: id rosnąco[cite: 13]
    if (diff === 0) {
      return a.id - b.id;
    }
    return diff;
  });

  return filtered;
}