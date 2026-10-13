"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function FiltersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentType = searchParams.get("type") || "all";
  const currentStock = searchParams.get("stock") || "all";
  const currentSort = searchParams.get("sort") || "name";

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push("?");
  };

  return (
    <div style={{
      background: "var(--card-bg)", padding: "1rem", borderRadius: "8px",
      border: "1px solid var(--border-color)", marginBottom: "2rem",
      display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center"
    }}>
      <label>
        Kategoria:
        <select value={currentType} onChange={(e) => updateFilter("type", e.target.value)} style={{ marginLeft: "0.5rem" }}>
          <option value="all">Wszystkie</option>
          <option value="cpu">Procesory</option>
          <option value="gpu">Karty graficzne</option>
          <option value="ram">Pamięci RAM</option>
          <option value="disk">Dyski</option>
        </select>
      </label>

      <label>
        Dostępność:
        <select value={currentStock} onChange={(e) => updateFilter("stock", e.target.value)} style={{ marginLeft: "0.5rem" }}>
          <option value="all">Wszystkie</option>
          <option value="available">Dostępne</option>
          <option value="unavailable">Niedostępne</option>
        </select>
      </label>

      <label>
        Sortowanie:
        <select value={currentSort} onChange={(e) => updateFilter("sort", e.target.value)} style={{ marginLeft: "0.5rem" }}>
          <option value="name">Nazwa (rosnąco)</option>
          <option value="newest">Najnowsze (malejąco)</option>
        </select>
      </label>

      <button onClick={clearFilters} style={{
        padding: "0.4rem 1rem", background: "var(--primary-color)",
        color: "#000", border: "none", borderRadius: "4px", cursor: "pointer"
      }}>
        Wyczyść filtry
      </button>
    </div>
  );
}
export function Filters() {
  return (
    <Suspense fallback={<div>Ładowanie filtrów...</div>}>
      <FiltersContent />
    </Suspense>
  );
}