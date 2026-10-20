import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Brak DATABASE_URL w pliku .env.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const ordersBefore = await prisma.order.findMany({
    orderBy: { orderNumber: "asc" },
    include: { items: { orderBy: { id: "asc" } } },
  });

  if (ordersBefore.length < 4) {
    throw new Error("Brak 4 zamówień w bazie. Uruchom najpierw: npx --no-install prisma db seed");
  }

  console.log("=== 4 DETERMINISTYCZNE ZAMÓWIENIA W BAZIE ===");
  for (const order of ordersBefore) {
    console.log(
      `${order.orderNumber} | Status: ${order.status} | Suma: ${order.totalAmount.toString()} gr (${(Number(order.totalAmount) / 100).toFixed(2)} zł)`,
    );
  }

  const product1 = await prisma.product.findUniqueOrThrow({ where: { id: 1 } });
  const originalPrice = product1.price;
  const newCatalogPrice = originalPrice + 50000; // podwyżka o 500.00 zł

  try {
    console.log(
      `\nZmiana ceny katalogowej produktu #1 (${product1.name}): ${originalPrice} gr -> ${newCatalogPrice} gr`,
    );
    await prisma.product.update({
      where: { id: 1 },
      data: { price: newCatalogPrice },
    });

    const orderAfter = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: "ORD-2026-0001" },
      include: { items: true },
    });
    const itemSnapshot = orderAfter.items.find((i) => i.productId === 1);

    console.log(
      `Po zmianie w katalogu -> Zamówienie ${orderAfter.orderNumber}: cena jednostkowa snapshot = ${itemSnapshot?.unitPrice} gr, suma zamówienia = ${orderAfter.totalAmount.toString()} gr`,
    );

    if (itemSnapshot?.unitPrice !== originalPrice) {
      throw new Error("BŁĄD: Zmiana ceny produktu wpłynęła na historię zamówienia!");
    }
    console.log("Wniosek: Zmiana aktualnej ceny produktu w katalogu NIE zmienia wartości historycznych zamówień.");
  } finally {
    await prisma.product.update({
      where: { id: 1 },
      data: { price: originalPrice },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Błąd weryfikacji zamówień:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });