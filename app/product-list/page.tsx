import { Suspense } from "react";
import { getFilteredCatalog, CatalogFilters } from "@/lib/repository";
import { Filters } from "@/components/Filters";
import Image from "next/image";
import Link from "next/link";

async function ProductGrid({ filters }: { filters: CatalogFilters }) {
  const products = await getFilteredCatalog(filters);

  if (products.length === 0) {
    return <p>Brak produktów spełniających wybrane kryteria.</p>;
  }

  return (
    <ul className="product-grid">
      {products.map((product) => (
        <li key={product.id} className="product-card">
          {}
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

export default async function ProductList({ searchParams }: Props) {
  const resolvedParams = await searchParams;

  const getSingleValue = (val: string | string[] | undefined) => 
    Array.isArray(val) ? val[0] : val;

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

  const filters: CatalogFilters = {
    type: typeRaw as CatalogFilters["type"],
    stock: stockRaw as CatalogFilters["stock"],
    sort: sortRaw as CatalogFilters["sort"],
  };

  return (
    <div>
      <h1>Katalog produktów</h1>
      
      {}
      {hasInvalidParams && (
        <div style={{ padding: "1rem", background: "salmon", color: "#000", marginBottom: "1rem", borderRadius: "8px" }}>
          Pominięto nieprawidłowe wartości filtrów z adresu URL.
        </div>
      )}

      {}
      <Filters />

      {}
      <Suspense fallback={
          <p>Pobieranie asortymentu...</p>
      }>
        <ProductGrid filters={filters} />
      </Suspense>
    </div>
  );
}