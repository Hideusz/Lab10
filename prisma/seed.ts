
import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
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

async function main(): Promise<void> {
  // 1. Wczytanie i walidacja wszystkich produktów przed zapisem.
  const filePath = path.join(
    process.cwd(),
    "data",
    "products.json",
  );

  const fileContents = await readFile(filePath, "utf8");
  const rawData: unknown = JSON.parse(fileContents);
  const products = productsArraySchema.parse(rawData);

  if (products.length !== 100) {
    throw new Error(
      `Oczekiwano 100 produktów, otrzymano ${products.length}.`,
    );
  }

  // PostgreSQL INTEGER ma zakres od -2147483648 do 2147483647.
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

  // Sprawdzenie, czy źródło zawiera wszystkie cztery kategorie
  // oraz przynajmniej jeden produkt z zerowym stanem.
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

  // 2. Zapis kategorii i produktów w jednej transakcji.
  // Jeśli zapis się nie powiedzie, transakcja zostanie wycofana.
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
        select: {
          id: true,
          code: true,
        },
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
        create: {
          id: product.id,
          ...productData,
        },
        update: productData,
      });
    }
  });

  // 3. Kontrola liczby rekordów po zatwierdzeniu transakcji.
  const [categoryCount, productCount, zeroStockCount] =
    await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.product.count({
        where: { amount: 0 },
      }),
    ]);

  console.log("Seed zakończony pomyślnie.");
  console.log(`Kategorie w bazie: ${categoryCount}`);
  console.log(`Produkty w bazie: ${productCount}`);
  console.log(`Produkty ze stanem 0: ${zeroStockCount}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed nie powiódł się:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
