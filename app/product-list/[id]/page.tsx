import { getProductById } from "@/lib/repository";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

// Generowanie tytułu strony na podstawie produktu[cite: 13]
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: idStr } = await params;
  const product = await getProductById(Number(idStr));
  if (!product) return { title: "Nie znaleziono produktu" };
  
  return {
    title: `${product.name} - Sklep Komputerowy`,
  };
}

export default async function ProductDetails({ params }: Props) {
  // Asynchroniczny odczyt parametrów zgodnie z Next.js 16.3[cite: 12, 13]
  const { id: idStr } = await params;

  // Rygorystyczna walidacja: brak zer wiodących, bezpieczny zakres, same cyfry[cite: 12, 13]
  const isValidFormat = /^[1-9]\d*$/.test(idStr);
  if (!isValidFormat) notFound();

  const idNum = Number(idStr);
  if (!Number.isSafeInteger(idNum) || idNum > 2147483647) notFound();

  const product = await getProductById(idNum);
  
  // Jeśli funkcja repozytorium zwróci null, rzucamy 404[cite: 13]
  if (!product) notFound();

  return (
    <div className="product-details" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem" }}>
        <a href="/product-list" style={{ color: "var(--primary-color)", textDecoration: "none" }}>
          &larr; Wróć do katalogu
        </a>
      </div>
      
      <h1>{product.name}</h1>
      <div style={{ display: "flex", gap: "2rem", marginTop: "2rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1", minWidth: "300px" }}>
          <Image 
            src={product.image} 
            alt={product.name} 
            width={400} 
            height={400} 
            style={{ width: "100%", height: "auto", borderRadius: "8px" }} 
          />
        </div>
        <div style={{ flex: "1", minWidth: "300px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p><strong>Kod produktu:</strong> {product.code}</p>
          <p><strong>Kategoria:</strong> {product.type}</p>
          <p><strong>Data dodania:</strong> {new Date(product.date).toLocaleDateString("pl-PL")}</p>
          <p><strong>Opis:</strong> {product.description}</p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary-color)" }}>
            {(product.price / 100).toFixed(2)} zł
          </p>
          <p style={{ 
            color: product.amount > 0 ? "lightgreen" : "salmon", 
            fontWeight: "bold" 
          }}>
            {product.amount > 0 ? `Dostępność: ${product.amount} szt.` : "Niedostępny"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Rozszerzenie: Prerenderowanie podczas budowania aplikacji dla wybranych ID
export async function generateStaticParams() {
  // Przykładowo generujemy statycznie gotowe HTML-e dla pierwszych 5 produktów
  return [
    { id: "1" },
    { id: "2" },
    { id: "3" },
    { id: "4" },
    { id: "5" },
  ];
}

// Ustawienie true pozwala renderować "w locie" pozostałe produkty, których tu nie wypisaliśmy[cite: 16]
export const dynamicParams = true;