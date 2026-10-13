import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Product, productsArraySchema } from "./types";

async function loadProducts(): Promise<Product[]> {
  await new Promise(resolve => setTimeout(resolve, 1500));  
  const filePath = path.join(process.cwd(), "data", "products.json");
  
  try {
    const fileContents = await fs.readFile(filePath, "utf8");
    const parsedJson = JSON.parse(fileContents);
    const validatedProducts = productsArraySchema.parse(parsedJson);
    return validatedProducts;
  } catch (error) {
    console.error("Błąd wczytywania lub walidacji produktów z pliku", error);
    throw new Error("Nie można pobrać danych.");
  }
}

export async function getCatalog(sortBy: "name" | "date" = "name", descending: boolean = false): Promise<Product[]> {
  const products = await loadProducts();
  
  const sorted = [...products].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "name") {
      comparison = a.name.localeCompare(b.name, "pl");
    } else {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return descending ? -comparison : comparison;
  });
  return sorted;
}

export async function getCatalogByAvailability(isAvailable: boolean): Promise<Product[]> {
    const products = await loadProducts();
    return products.filter(p => isAvailable ? p.amount > 0 : p.amount === 0);
}

export async function getCatalogByCategory(type: "cpu" | "gpu" | "ram" | "disk"): Promise<Product[]> {
    const products = await loadProducts();
    return products.filter(p => p.type === type);
}

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
  
  let filtered = products.filter(p => {
    const matchType = filters.type === "all" || p.type === filters.type;
    const matchStock = filters.stock === "all" 
      ? true 
      : filters.stock === "available" ? p.amount > 0 : p.amount === 0;
    
    return matchType && matchStock;
  });

  filtered.sort((a, b) => {
    let diff = 0;
    if (filters.sort === "newest") {
      diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    } else {
      diff = a.name.localeCompare(b.name, "pl");
    }
    
    if (diff === 0) {
      return a.id - b.id;
    }
    return diff;
  });

  return filtered;
}