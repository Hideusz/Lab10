import Image from "next/image";
import Link from "next/link";
import { getProductForRoute } from "@/lib/product-route";
import { connection } from "next/server";

type Props = {
  params: Promise<{ id: string }>;
};

/** Pełna strona obrazu używana przy bezpośrednim wejściu lub odświeżeniu URL. */
export default async function ProductImagePage({ params }: Props) {
  await connection();
  const { id } = await params;
  const product = await getProductForRoute(id);

  return (
    <section className="product-image-page">
      <p className="product-image-page__back">
        <Link href={`/product-list/${product.id}`}>
          &larr; Wróć do produktu
        </Link>
      </p>
      <h1>{product.name} — zdjęcie</h1>
      <div className="product-image-page__frame">
        <Image
          src={product.image}
          alt={`Zdjęcie produktu: ${product.name}`}
          width={1200}
          height={1200}
          sizes="(max-width: 800px) 100vw, 800px"
          className="product-image-page__image"
        />
      </div>
    </section>
  );
}
