import { Suspense } from "react";
import { getFilteredCatalog, CatalogFilters } from "@/lib/repository";
import { Filters } from "@/components/Filters";
import Image from "next/image";
import Link from "next/link";

// 1. Asynchroniczny komponent pobierający dane (zawiesi się na czas opóźnienia)
async function ProductGrid({ filters }: { filters: CatalogFilters }) {
  const products = await getFilteredCatalog(filters);

  if (products.length === 0) {
    return <p>Brak produktów spełniających wybrane kryteria.</p>;
  }

  return (
    <ul className="product-grid">
      {products.map((product) => (
        <li key={product.id} className="product-card">
          {/* Obejmujemy kartę Linkiem, zgodnie z wymogiem przejścia do szczegółów */}
          <Link href={`/product-list/${product.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <Image 
              src={product.image} 
              alt={product.name} 
              width={400} 
              height={400} 
              style={{ width: "100%", height: "auto", borderRadius: "8px", marginBottom: "1rem" }} 
            />
            <h2>{product.name}</h2>
            <p><strong>Kategoria:</strong> {product.type}</p>
            <p><strong>Cena:</strong> {(product.price / 100).toFixed(2)} zł</p>
            <p>
              <strong>Dostępność:</strong> {product.amount > 0 ? `${product.amount} szt.` : "Niedostępny"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// 2. Główny komponent strony (ładuje się natychmiast)
export default async function ProductList({ searchParams }: Props) {
  // Asynchroniczny odczyt searchParams (w Next 16.3 to Promise)
  const resolvedParams = await searchParams;

  // Funkcja pomocnicza: pobiera pierwszy element, jeśli to tablica (ignoruje powielone klucze)
  const getSingleValue = (val: string | string[] | undefined) => 
    Array.isArray(val) ? val[0] : val;

  // Walidacja - zrzucamy nieznane wartości do domyślnych
  let hasInvalidParams = false;

  let typeRaw = getSingleValue(resolvedParams.type) || "all";
  if (!["all", "cpu", "gpu", "ram", "disk"].includes(typeRaw)) {
    typeRaw = "all";
    hasInvalidParams = true;
  }

  let stockRaw = getSingleValue(resolvedParams.stock) || "all";
  if (!["all", "available", "unavailable"].includes(stockRaw)) {
    stockRaw = "all";
    hasInvalidParams = true;
  }

  let sortRaw = getSingleValue(resolvedParams.sort) || "name";
  if (!["name", "newest"].includes(sortRaw)) {
    sortRaw = "name";
    hasInvalidParams = true;
  }

  // Budujemy zwalidowany, otypowany obiekt filtrów
  const filters: CatalogFilters = {
    type: typeRaw as CatalogFilters["type"],
    stock: stockRaw as CatalogFilters["stock"],
    sort: sortRaw as CatalogFilters["sort"],
  };

  return (
    <div>
      <h1>Katalog produktów</h1>
      
      {/* Komunikat o zignorowaniu błędnych parametrów */}
      {hasInvalidParams && (
        <div style={{ padding: "1rem", background: "salmon", color: "#000", marginBottom: "1rem", borderRadius: "8px" }}>
          Pominięto nieprawidłowe wartości filtrów z adresu URL.
        </div>
      )}

      {/* Komponent klienta do zmiany URL */}
      <Filters />

      {/* 3. Suspense otacza TYLKO pobieranie i renderowanie samych produktów */}
      <Suspense fallback={
          <p>Pobieranie asortymentu...</p>
      }>
        <ProductGrid filters={filters} />
      </Suspense>
    </div>
  );
}