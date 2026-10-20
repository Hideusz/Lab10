import "server-only";
import { prisma } from "./prisma";
import type { Product } from "./types";

export type CatalogFilters = {
  type: "all" | "cpu" | "gpu" | "ram" | "disk";
  stock: "all" | "available" | "unavailable";
  sort: "name" | "newest";
};

const productSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  image: true,
  price: true,
  amount: true,
  date: true,
  category: {
    select: {
      code: true,
    },
  },
} as const;

function toProduct(row: {
  id: number;
  code: string;
  name: string;
  description: string;
  image: string;
  price: number;
  amount: number;
  date: Date;
  category: { code: string };
}): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.category.code as Product["type"],
    price: row.price,
    amount: row.amount,
    description: row.description,
    date: row.date.toISOString(),
    image: row.image,
  };
}

export async function getCatalog(
  sortBy: "name" | "date" = "name",
  descending = false,
): Promise<Product[]> {
  const direction = descending ? "desc" as const : "asc" as const;

  const orderBy =
    sortBy === "name"
      ? [{ nameSortKey: direction }, { id: direction }]
      : [{ date: direction }, { id: direction }];

  const rows = await prisma.product.findMany({
    select: productSelect,
    orderBy,
  });

  return rows.map(toProduct);
}

export async function getCatalogByAvailability(
  isAvailable: boolean,
): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      amount: isAvailable ? { gt: 0 } : 0,
    },
    select: productSelect,
    orderBy: [{ id: "asc" }],
  });

  return rows.map(toProduct);
}

export async function getCatalogByCategory(
  type: "cpu" | "gpu" | "ram" | "disk",
): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      category: {
        code: type,
      },
    },
    select: productSelect,
    orderBy: [{ id: "asc" }],
  });

  return rows.map(toProduct);
}

export async function getProductById(
  id: number,
): Promise<Product | null> {
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    id > 2147483647
  ) {
    return null;
  }

  const row = await prisma.product.findUnique({
    where: { id },
    select: productSelect,
  });

  return row ? toProduct(row) : null;
}

export async function getFilteredCatalog(
  filters: CatalogFilters,
): Promise<Product[]> {
  const where = {
    ...(filters.type !== "all"
      ? { category: { code: filters.type } }
      : {}),
    ...(filters.stock === "available"
      ? { amount: { gt: 0 } }
      : filters.stock === "unavailable"
        ? { amount: 0 }
        : {}),
  };

  const orderBy =
    filters.sort === "newest"
      ? [{ date: "desc" as const }, { id: "asc" as const }]
      : [{ nameSortKey: "asc" as const }, { id: "asc" as const }];

  const rows = await prisma.product.findMany({
    where,
    select: productSelect,
    orderBy,
  });

  return rows.map(toProduct);
}