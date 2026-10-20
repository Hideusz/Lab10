import { ImageModal } from "@/components/ImageModal";
import { getProductForRoute } from "@/lib/product-route";
import { connection } from "next/server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function InterceptedProductImage({ params }: Props) {
  await connection();
  const { id } = await params;
  const product = await getProductForRoute(id);

  return (
    <ImageModal
      productId={product.id}
      productName={product.name}
      image={product.image}
    />
  );
}
