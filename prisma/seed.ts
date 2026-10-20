import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, OrderStatus } from "../lib/generated/prisma/client";
import { productsArraySchema } from "../lib/types";
import { nameSortKey } from "../lib/name-sort-key";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Brak DATABASE_URL w pliku .env.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const categories = [
  { code: "cpu", name: "Procesory" },
  { code: "gpu", name: "Karty graficzne" },
  { code: "ram", name: "Pamięć RAM" },
  { code: "disk", name: "Dyski" },
] as const;

const demoUser = {
  id: "user-demo-better-auth-01",
  name: "Jan Kowalski",
  email: "jan.kowalski@example.com",
  emailVerified: true,
  image: "/images/avatars/default.png",
  createdAt: new Date("2026-01-15T10:00:00.000Z"),
  updatedAt: new Date("2026-01-15T10:00:00.000Z"),
} as const;

const deterministicCartBlueprint = [
  { productId: 1, quantity: 2 },
  { productId: 2, quantity: 1 },
] as const;

const deterministicOrdersBlueprint: Array<{
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  items: Array<{ productId: number; quantity: number }>;
}> = [
  {
    orderNumber: "ORD-2026-0001",
    status: "COMPLETED",
    createdAt: "2026-02-10T12:00:00.000Z",
    items: [
      { productId: 1, quantity: 1 },
      { productId: 3, quantity: 2 },
    ],
  },
  {
    orderNumber: "ORD-2026-0002",
    status: "SHIPPED",
    createdAt: "2026-03-05T15:30:00.000Z",
    items: [
      { productId: 4, quantity: 2 },
      { productId: 5, quantity: 1 },
    ],
  },
  {
    orderNumber: "ORD-2026-0003",
    status: "PAID",
    createdAt: "2026-04-12T09:15:00.000Z",
    items: [{ productId: 6, quantity: 3 }],
  },
  {
    orderNumber: "ORD-2026-0004",
    status: "PENDING",
    createdAt: "2026-05-01T18:45:00.000Z",
    items: [
      { productId: 7, quantity: 1 },
      { productId: 8, quantity: 4 },
    ],
  },
];

async function main(): Promise<void> {
  // 1. Wczytanie i walidacja wszystkich produktów przed zapisem.
  const filePath = path.join(process.cwd(), "data", "products.json");
  const fileContents = await readFile(filePath, "utf8");
  const rawData: unknown = JSON.parse(fileContents);
  const products = productsArraySchema.parse(rawData);

  if (products.length !== 100) {
    throw new Error(
      `Oczekiwano 100 produktów, otrzymano ${products.length}.`,
    );
  }

  for (const product of products) {
    if (
      product.id > 2147483647 ||
      product.price > 2147483647 ||
      product.amount > 2147483647
    ) {
      throw new Error(
        `Produkt ${product.id} przekracza zakres INTEGER PostgreSQL.`,
      );
    }
  }

  const productTypes = new Set(products.map((p) => p.type));
  for (const category of categories) {
    if (!productTypes.has(category.code)) {
      throw new Error(
        `Brak produktów kategorii ${category.code} w pliku JSON.`,
      );
    }
  }

  if (!products.some((p) => p.amount === 0)) {
    throw new Error(
      "W danych nie ma produktu z zerowym stanem magazynowym.",
    );
  }

  const productsById = new Map(products.map((p) => [p.id, p]));

  // 2. Zapis kategorii, produktów, użytkownika, koszyka i 4 zamówień w jednej transakcji.
  await prisma.$transaction(async (tx) => {
    const categoryIds = new Map<string, number>();

    for (const category of categories) {
      const savedCategory = await tx.category.upsert({
        where: { code: category.code },
        update: { name: category.name },
        create: {
          code: category.code,
          name: category.name,
        },
        select: { id: true, code: true },
      });

      categoryIds.set(savedCategory.code, savedCategory.id);
    }

    for (const product of products) {
      const categoryId = categoryIds.get(product.type);
      if (categoryId === undefined) {
        throw new Error(
          `Nie znaleziono kategorii dla produktu ${product.id}.`,
        );
      }

      const productData = {
        code: product.code,
        name: product.name,
        nameSortKey: nameSortKey(product.name),
        description: product.description,
        image: product.image,
        price: product.price,
        amount: product.amount,
        date: new Date(product.date),
        categoryId,
      };

      await tx.product.upsert({
        where: { id: product.id },
        create: { id: product.id, ...productData },
        update: productData,
      });
    }

    // Rozszerzenie: Fikcyjny użytkownik zgodny z Better Auth
    await tx.user.upsert({
      where: { email: demoUser.email },
      update: {
        name: demoUser.name,
        emailVerified: demoUser.emailVerified,
        image: demoUser.image,
      },
      create: demoUser,
    });

    // Rozszerzenie: Model koszyka (Cart + CartItem)
    const savedCart = await tx.cart.upsert({
      where: { userId: demoUser.id },
      update: {},
      create: {
        userId: demoUser.id,
      },
    });

    for (const item of deterministicCartBlueprint) {
      await tx.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: savedCart.id,
            productId: item.productId,
          },
        },
        update: { quantity: item.quantity },
        create: {
          cartId: savedCart.id,
          productId: item.productId,
          quantity: item.quantity,
        },
      });
    }

    // Rozszerzenie: Historia zamówień (4 deterministyczne zamówienia ze snapshotem)
    for (const orderDef of deterministicOrdersBlueprint) {
      const resolvedItems = orderDef.items.map((item) => {
        const prod = productsById.get(item.productId);
        if (!prod) {
          throw new Error(
            `Brak produktu ${item.productId} dla zamówienia ${orderDef.orderNumber}.`,
          );
        }
        const lineTotal = BigInt(prod.price) * BigInt(item.quantity);
        return {
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          unitPrice: prod.price,
          quantity: item.quantity,
          lineTotal,
        };
      });

      const totalAmount = resolvedItems.reduce(
        (acc, curr) => acc + curr.lineTotal,
        0n,
      );

      const savedOrder = await tx.order.upsert({
        where: { orderNumber: orderDef.orderNumber },
        update: {
          status: orderDef.status,
          totalAmount,
        },
        create: {
          orderNumber: orderDef.orderNumber,
          userId: demoUser.id,
          status: orderDef.status,
          totalAmount,
          createdAt: new Date(orderDef.createdAt),
        },
      });

      for (const item of resolvedItems) {
        await tx.orderItem.upsert({
          where: {
            orderId_productCode: {
              orderId: savedOrder.id,
              productCode: item.productCode,
            },
          },
          update: {
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          },
          create: {
            orderId: savedOrder.id,
            ...item,
          },
        });
      }
    }
  });

  // 3. Kontrola liczby rekordów po zatwierdzeniu transakcji.
  const [
    categoryCount,
    productCount,
    zeroStockCount,
    userCount,
    cartCount,
    cartItemCount,
    orderCount,
    orderItemCount,
  ] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.product.count({ where: { amount: 0 } }),
    prisma.user.count(),
    prisma.cart.count(),
    prisma.cartItem.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
  ]);

  console.log("Seed zakończony pomyślnie.");
  console.log(`Kategorie w bazie: ${categoryCount}`);
  console.log(`Produkty w bazie: ${productCount} (w tym ze stanem 0: ${zeroStockCount})`);
  console.log(`Użytkownicy: ${userCount}, Koszyki: ${cartCount} (pozycji: ${cartItemCount})`);
  console.log(`Zamówienia: ${orderCount} (pozycji: ${orderItemCount})`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed nie powiódł się:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });