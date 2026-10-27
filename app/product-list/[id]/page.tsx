import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getProductForRoute } from "@/lib/product-route";
import { connection } from "next/server";
import { AddToCartButton } from "@/components/AddToCartButton";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const product = await getProductForRoute(id);

  return {
    title: `${product.name} - Sklep Komputerowy`,
  };
}

export default async function ProductDetails({ params }: Props) {
  await connection();
  const { id } = await params;
  const product = await getProductForRoute(id);

  return (
    <div className="product-details" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/product-list" className="text-link">
          &larr; Wróć do katalogu
        </Link>
      </div>

      <h1>{product.name}</h1>
      <div style={{ display: "flex", gap: "2rem", marginTop: "2rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1", minWidth: "min(100%, 300px)" }}>
          <Link
            id={`product-image-trigger-${product.id}`}
            href={`/product-list/${product.id}/image`}
            className="product-image-link product-details__image-link"
            aria-label={`Powiększ zdjęcie produktu ${product.name}`}
          >
            <Image
              src={product.image}
              alt={product.name}
              width={400}
              height={400}
              sizes="(max-width: 700px) 100vw, 400px"
              style={{ width: "100%", height: "auto", borderRadius: "8px" }}
            />
          </Link>
        </div>
        <div style={{ flex: "1", minWidth: "min(100%, 300px)", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p><strong>Kod produktu:</strong> {product.code}</p>
          <p><strong>Kategoria:</strong> {product.type}</p>
          <p><strong>Data dodania:</strong> {new Date(product.date).toLocaleDateString("pl-PL")}</p>
          <p><strong>Opis:</strong> {product.description}</p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary-color)" }}>
            {(product.price / 100).toFixed(2)} zł
          </p>
          <p style={{ color: product.amount > 0 ? "lightgreen" : "salmon", fontWeight: "bold" }}>
            {product.amount > 0 ? `Dostępność: ${product.amount} szt.` : "Niedostępny"}
          </p>
          <AddToCartButton productId={product.id} disabled={product.amount <= 0} />
        </div>
      </div>
    </div>
  );
}

