import { getCatalog } from "@/lib/repository";
import Image from "next/image";

export default async function ProductList() {
  const products = await getCatalog();

  if (products.length === 0) {
    return (
      <div>
        <h1>Katalog produktów</h1>
        <p>Brak produktów w katalogu.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Katalog produktów</h1>
      <ul className="product-grid">
        {products.map((product) => (
          <li key={product.id} className="product-card">
            <h2>{product.name}</h2>
            <p><strong>Kategoria:</strong> {product.type}</p>
            <p><strong>Cena:</strong> {(product.price / 100).toFixed(2)} zł</p>
            <p>
              <strong>Dostępność:</strong> {product.amount > 0 ? `${product.amount} szt.` : "Niedostępny"}
            </p>
            <Image 
                src={product.image} 
                alt={product.name} 
                width={400} 
                height={400} 
                style={{ width: "100%", height: "auto", borderRadius: "4px" }} 
                />
          </li>
        ))}
      </ul>
    </div>
  );
}