import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "./prisma";
import {
  getCatalogByAvailability,
  getCatalogByCategory,
  getFilteredCatalog,
  getProductById,
} from "./repository";
import { nameSortKey } from "./name-sort-key";
import { productSchema, productsArraySchema } from "./types";

function assertTestDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url || new URL(url).pathname !== "/shop_test_db") {
    throw new Error("Ochrona danych: testy mogą czyścić wyłącznie bazę /shop_test_db!");
  }
}

const controlledCategories = [
  { code: "cpu", name: "Procesory" },
  { code: "gpu", name: "Karty graficzne" },
  { code: "ram", name: "Pamięć RAM" },
  { code: "disk", name: "Dyski" },
] as const;

const controlledProducts = [
  {
    id: 1,
    code: "CPUTEST001",
    name: "Żelazny Procesor",
    type: "cpu" as const,
    price: 129900,
    amount: 5,
    description: "Polski znak Ż na początku",
    date: "2026-03-15T10:20:30.123Z",
    image: "/images/products/cpu.webp",
  },
  {
    id: 2,
    code: "CPUTEST002",
    name: "Adata Core",
    type: "cpu" as const,
    price: 89900,
    amount: 0,
    description: "Produkt niedostępny (stan 0)",
    date: "2026-04-01T08:00:00.456Z",
    image: "/images/products/cpu.webp",
  },
  {
    id: 3,
    code: "GPUTEST003",
    name: "adata Core",
    type: "gpu" as const,
    price: 249900,
    amount: 3,
    description: "Mała litera na początku, ta sama data co ID 4 (remis)",
    date: "2026-05-10T12:00:00.789Z",
    image: "/images/products/gpu.webp",
  },
  {
    id: 4,
    code: "RAMTEST004",
    name: "Ącki Moduł RAM",
    type: "ram" as const,
    price: 45000,
    amount: 10,
    description: "Polski znak Ą, ta sama data co ID 3",
    date: "2026-05-10T12:00:00.789Z",
    image: "/images/products/ram.webp",
  },
  {
    id: 5,
    code: "DSKTEST005",
    name: "Adata Core",
    type: "disk" as const,
    price: 35000,
    amount: 1,
    description: "Remis nazwy z produktem ID 2",
    date: "2026-02-01T00:00:00.001Z",
    image: "/images/products/disk.webp",
  },
];

beforeEach(async () => {
  assertTestDatabase();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const categoryMap = new Map<string, number>();
  for (const cat of controlledCategories) {
    const created = await prisma.category.create({ data: cat });
    categoryMap.set(created.code, created.id);
  }

  for (const prod of controlledProducts) {
    await prisma.product.create({
      data: {
        id: prod.id,
        code: prod.code,
        name: prod.name,
        nameSortKey: nameSortKey(prod.name),
        description: prod.description,
        image: prod.image,
        price: prod.price,
        amount: prod.amount,
        date: new Date(prod.date),
        categoryId: categoryMap.get(prod.type)!,
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Walidatory Zod (Lab 06/08)", () => {
  test("Walidator odrzuca ujemną cenę oraz duplikaty kodów", () => {
    const badProduct = { ...controlledProducts[0], price: -100 };
    expect(productSchema.safeParse(badProduct).success).toBe(false);

    const duplicates = [
      controlledProducts[0],
      { ...controlledProducts[1], code: controlledProducts[0].code },
    ];
    expect(productsArraySchema.safeParse(duplicates).success).toBe(false);
  });
});

describe("Integracja repozytorium z PostgreSQL i Prisma (Tabela 8.1)", () => {
  test("Kolejność sortowania po nazwie w bazie (COLLATE C) jest identyczna z Buffer.compare z Lab 06", async () => {
    const dbSorted = await getFilteredCatalog({
      type: "all",
      stock: "all",
      sort: "name",
    });

    const memorySorted = [...controlledProducts].sort((a, b) => {
      const cmp = Buffer.compare(
        Buffer.from(a.name, "utf8"),
        Buffer.from(b.name, "utf8"),
      );
      return cmp !== 0 ? cmp : a.id - b.id;
    });

    expect(dbSorted.map((p) => p.id)).toEqual(memorySorted.map((p) => p.id));
    expect(dbSorted.map((p) => p.id)).toEqual([2, 5, 3, 4, 1]);
  });

  test("Sortowanie newest malejąco po dacie rozstrzyga remisy rosnąco po ID", async () => {
    const newest = await getFilteredCatalog({
      type: "all",
      stock: "all",
      sort: "newest",
    });
    expect(newest.map((p) => p.id)).toEqual([3, 4, 2, 1, 5]);
  });

  test("Filtry kategorii i dostępności łączą się poprawnie, obsługując stan zero", async () => {
    const availableCpu = await getFilteredCatalog({
      type: "cpu",
      stock: "available",
      sort: "name",
    });
    expect(availableCpu.map((p) => p.id)).toEqual([1]);

    const unavailableCpu = await getFilteredCatalog({
      type: "cpu",
      stock: "unavailable",
      sort: "name",
    });
    expect(unavailableCpu.map((p) => p.id)).toEqual([2]);

    const allUnavailable = await getCatalogByAvailability(false);
    expect(allUnavailable.map((p) => p.id)).toEqual([2]);

    const onlyGpu = await getCatalogByCategory("gpu");
    expect(onlyGpu.map((p) => p.id)).toEqual([3]);
  });

  test("Szczegóły produktu zachowują milisekundy w dacie ISO i obsługują nieprawidłowe/brakujące ID", async () => {
    const product = await getProductById(1);
    expect(product).not.toBeNull();
    expect(product?.date).toBe("2026-03-15T10:20:30.123Z");
    expect(product?.type).toBe("cpu");

    await expect(getProductById(0)).resolves.toBeNull();
    await expect(getProductById(-5)).resolves.toBeNull();
    await expect(getProductById(1.5)).resolves.toBeNull();
    await expect(getProductById(2147483648)).resolves.toBeNull();
    await expect(getProductById(999999)).resolves.toBeNull();
  });

  test("Ograniczenia SQL (CHECK, UNIQUE, FK RESTRICT) dla Product i Category blokują błędne dane", async () => {
    await expect(
      prisma.product.update({ where: { id: 1 }, data: { price: -1 } }),
    ).rejects.toThrow();

    await expect(
      prisma.product.update({ where: { id: 1 }, data: { amount: -5 } }),
    ).rejects.toThrow();

    const cpuCat = await prisma.category.findUniqueOrThrow({
      where: { code: "cpu" },
    });
    await expect(
      prisma.product.create({
        data: {
          id: 99,
          code: "CPUTEST001",
          name: "Duplikat",
          nameSortKey: nameSortKey("Duplikat"),
          description: "Opis",
          image: "/images/products/cpu.webp",
          price: 1000,
          amount: 1,
          date: new Date(),
          categoryId: cpuCat.id,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.product.update({ where: { id: 1 }, data: { categoryId: 999999 } }),
    ).rejects.toThrow();

    await expect(
      prisma.category.delete({ where: { id: cpuCat.id } }),
    ).rejects.toThrow();
  });
});

describe("Rozszerzenia Lab 08: Model koszyka i Historia zamówień", () => {
  test("Model koszyka: unikalność userId, unikalność (cartId, productId), CHECK 1..99 i kaskadowe usuwanie pozycji", async () => {
    const user = await prisma.user.create({
      data: {
        id: "user-test-1",
        name: "Anna Nowak",
        email: "anna.nowak@example.com",
        emailVerified: true,
      },
    });

    const cart = await prisma.cart.create({
      data: { userId: user.id },
    });

    // Drugi koszyk dla tego samego użytkownika musi zostać odrzucony (UNIQUE userId)
    await expect(
      prisma.cart.create({ data: { userId: user.id } }),
    ).rejects.toThrow();

    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: 1, quantity: 3 },
    });

    // Powtórzona para (cartId, productId) musi zostać odrzucona
    await expect(
      prisma.cartItem.create({
        data: { cartId: cart.id, productId: 1, quantity: 1 },
      }),
    ).rejects.toThrow();

    // Ograniczenie CHECK (quantity BETWEEN 1 AND 99) odrzuca 0 i 100
    await expect(
      prisma.cartItem.create({
        data: { cartId: cart.id, productId: 2, quantity: 0 },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.cartItem.create({
        data: { cartId: cart.id, productId: 2, quantity: 100 },
      }),
    ).rejects.toThrow();

    // Usunięcie koszyka kaskadowo usuwa jego pozycje
    await prisma.cart.delete({ where: { id: cart.id } });
    const remainingItems = await prisma.cartItem.count({
      where: { cartId: cart.id },
    });
    expect(remainingItems).toBe(0);
  });

  test("Historia zamówień: zmiana ceny produktu ani usunięcie produktu (SetNull) nie zmieniają historii, a CHECK chroni ilość i cenę", async () => {
    const user = await prisma.user.create({
      data: {
        id: "user-test-orders",
        name: "Piotr Wiśniewski",
        email: "piotr@example.com",
        emailVerified: true,
      },
    });

    const prod1 = await prisma.product.findUniqueOrThrow({ where: { id: 1 } });
    const quantity = 2;
    const lineTotal = BigInt(prod1.price) * BigInt(quantity);

    const order = await prisma.order.create({
      data: {
        orderNumber: "ORD-TEST-0001",
        userId: user.id,
        status: "PAID",
        totalAmount: lineTotal,
        items: {
          create: [
            {
              productId: prod1.id,
              productCode: prod1.code,
              productName: prod1.name,
              unitPrice: prod1.price,
              quantity,
              lineTotal,
            },
          ],
        },
      },
      include: { items: true },
    });

    // 1. Zmiana aktualnej ceny produktu w katalogu nie zmienia snapshotu zamówienia
    await prisma.product.update({
      where: { id: 1 },
      data: { price: 999999 },
    });

    const orderAfterPriceChange = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    expect(orderAfterPriceChange.items[0].unitPrice).toBe(129900);
    expect(orderAfterPriceChange.totalAmount).toBe(259800n);

    // 2. Usunięcie produktu z katalogu nie usuwa pozycji historii (ON DELETE SET NULL)
    await prisma.product.delete({ where: { id: 1 } });

    const orderAfterProductDelete = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    expect(orderAfterProductDelete.items).toHaveLength(1);
    expect(orderAfterProductDelete.items[0].productId).toBeNull();
    expect(orderAfterProductDelete.items[0].productCode).toBe("CPUTEST001");
    expect(orderAfterProductDelete.items[0].productName).toBe("Żelazny Procesor");
    expect(orderAfterProductDelete.items[0].unitPrice).toBe(129900);

    // 3. Ograniczenia CHECK na OrderItem odrzucają niedodatnią ilość i ujemną cenę jednostkową
    await expect(
      prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: 2,
          productCode: "CPUTEST002",
          productName: "Adata Core",
          unitPrice: 89900,
          quantity: 0,
          lineTotal: 0n,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: 2,
          productCode: "CPUTEST002",
          productName: "Adata Core",
          unitPrice: -10,
          quantity: 1,
          lineTotal: -10n,
        },
      }),
    ).rejects.toThrow();
  });
});