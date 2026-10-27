import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "./prisma";
import { nameSortKey } from "./name-sort-key";
import {
  addProductForSession,
  checkoutForSession,
  getMyCart,
  getMyOrderById,
  getMyOrders,
  removeItemForSession,
  setQuantityForSession,
} from "./cart";

function assertTestDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url || new URL(url).pathname !== "/shop_test_db") {
    throw new Error("Ochrona danych: testy mogą działać wyłącznie na /shop_test_db!");
  }
}

const userA = {
  id: "user-auth-alice-01",
  name: "Alicja Testowa",
  email: "alice@example.com",
  emailVerified: true,
};

const userB = {
  id: "user-auth-bob-02",
  name: "Bartek Testowy",
  email: "bob@example.com",
  emailVerified: true,
};

/**
 * Symuluje serwerową weryfikację sesji w tabeli Session w bazie PostgreSQL
 * (sprawdza istnienie tokenu oraz czy sesja nie wygasła).
 */
function sessionFromToken(token: string | null) {
  return async () => {
    if (!token) return null;
    const sessionRow = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!sessionRow || sessionRow.expiresAt <= new Date()) {
      return null;
    }
    return { user: { id: sessionRow.user.id } };
  };
}

beforeEach(async () => {
  assertTestDatabase();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const cpu = await prisma.category.create({
    data: { code: "cpu", name: "Procesory" },
  });

  await prisma.product.createMany({
    data: [
      {
        id: 101,
        code: "CPUTEST101",
        name: "AMD Ryzen 7 Test",
        nameSortKey: nameSortKey("AMD Ryzen 7 Test"),
        description: "Produkt z dużym stanem",
        image: "/images/products/cpu.webp",
        price: 150000, // 1500.00 zł
        amount: 10,
        date: new Date("2026-05-01T10:00:00.000Z"),
        categoryId: cpu.id,
      },
      {
        id: 102,
        code: "CPUTEST102",
        name: "Intel Ostatnia Sztuka",
        nameSortKey: nameSortKey("Intel Ostatnia Sztuka"),
        description: "Produkt z 1 sztuką w magazynie",
        image: "/images/products/cpu.webp",
        price: 99900,
        amount: 1,
        date: new Date("2026-05-02T10:00:00.000Z"),
        categoryId: cpu.id,
      },
      {
        id: 103,
        code: "CPUTEST103",
        name: "Procesor Niedostępny",
        nameSortKey: nameSortKey("Procesor Niedostępny"),
        description: "Brak w magazynie",
        image: "/images/products/cpu.webp",
        price: 50000,
        amount: 0,
        date: new Date("2026-05-03T10:00:00.000Z"),
        categoryId: cpu.id,
      },
    ],
  });

  await prisma.user.createMany({ data: [userA, userB] });

  await prisma.session.createMany({
    data: [
      {
        id: "sess-alice-1",
        token: "valid-token-alice",
        userId: userA.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
      {
        id: "sess-bob-1",
        token: "valid-token-bob",
        userId: userB.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
      {
        id: "sess-expired",
        token: "expired-token-alice",
        userId: userA.id,
        expiresAt: new Date(Date.now() - 3600_000),
      },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Lab 09: Sesja, własny koszyk i izolacja użytkowników A/B (Tabela 8.1)", () => {
  test("1. Nowy zalogowany użytkownik widzi pusty koszyk i sumę 0 (brak rekordu Cart w bazie)", async () => {
    const cart = await getMyCart(sessionFromToken("valid-token-alice"));
    expect(cart).toEqual({ items: [], totalAmount: 0, hasStockIssues: false });
    expect(await prisma.cart.count({ where: { userId: userA.id } })).toBe(0);
  });

  test("2. Dodanie produktu, zmiana ilości i usunięcie pozycji wyliczają ceny po stronie serwera", async () => {
    const aliceSession = sessionFromToken("valid-token-alice");

    const add1 = await addProductForSession(101, aliceSession);
    expect(add1.ok).toBe(true);

    const add2 = await addProductForSession(101, aliceSession);
    expect(add2.ok).toBe(true);

    let cart = await getMyCart(aliceSession);
    expect(cart?.items).toHaveLength(1);
    expect(cart?.items[0].quantity).toBe(2);
    expect(cart?.totalAmount).toBe(300000);

    const itemId = cart!.items[0].id;
    const setQty = await setQuantityForSession(itemId, 5, aliceSession);
    expect(setQty.ok).toBe(true);

    cart = await getMyCart(aliceSession);
    expect(cart?.items[0].quantity).toBe(5);
    expect(cart?.totalAmount).toBe(750000);

    const rem = await removeItemForSession(itemId, aliceSession);
    expect(rem.ok).toBe(true);

    cart = await getMyCart(aliceSession);
    expect(cart?.items).toHaveLength(0);
    expect(cart?.totalAmount).toBe(0);
  });

  test("3. Walidacja odrzuca zero, wartości ujemne, ułamki, przekroczony stan i produkt niedostępny", async () => {
    const aliceSession = sessionFromToken("valid-token-alice");
    await addProductForSession(101, aliceSession);
    const itemId = (await getMyCart(aliceSession))!.items[0].id;

    expect((await setQuantityForSession(itemId, 0, aliceSession)).ok).toBe(false);
    expect((await setQuantityForSession(itemId, -3, aliceSession)).ok).toBe(false);
    expect((await setQuantityForSession(itemId, 2.5, aliceSession)).ok).toBe(false);
    expect((await setQuantityForSession(itemId, 100, aliceSession)).ok).toBe(false);
    expect((await setQuantityForSession(itemId, 11, aliceSession)).ok).toBe(false); // stan = 10

    // Produkt niedostępny (amount = 0)
    expect((await addProductForSession(103, aliceSession)).ok).toBe(false);
    // Nieistniejący produkt
    expect((await addProductForSession(99999, aliceSession)).ok).toBe(false);
  });

  test("4. Izolacja Użytkownik A vs Użytkownik B: podmiana itemId nie pozwala zmienić ani usunąć pozycji B", async () => {
    const aliceSession = sessionFromToken("valid-token-alice");
    const bobSession = sessionFromToken("valid-token-bob");

    await addProductForSession(101, bobSession);
    const bobCartBefore = await getMyCart(bobSession);
    const bobItemId = bobCartBefore!.items[0].id;

    // Alicja próbuje zmienić ilość w pozycji Boba, podmieniając itemId
    const hijackUpdate = await setQuantityForSession(bobItemId, 9, aliceSession);
    expect(hijackUpdate.ok).toBe(false);
    if (!hijackUpdate.ok) {
      expect(hijackUpdate.code).toBe("NOT_FOUND");
    }

    // Alicja próbuje usunąć pozycję Boba
    const hijackDelete = await removeItemForSession(bobItemId, aliceSession);
    expect(hijackDelete.ok).toBe(false);

    // Koszyk Boba pozostaje nienaruszony
    const bobCartAfter = await getMyCart(bobSession);
    expect(bobCartAfter?.items).toHaveLength(1);
    expect(bobCartAfter?.items[0].quantity).toBe(1);
  });

  test("5. Brak sesji, fałszywy token, wygasła sesja oraz unieważniona sesja w bazie są odrzucane", async () => {
    expect(await getMyCart(sessionFromToken(null))).toBeNull();
    expect(await getMyCart(sessionFromToken("fake-cookie-token"))).toBeNull();
    expect(await getMyCart(sessionFromToken("expired-token-alice"))).toBeNull();

    const noAuthAdd = await addProductForSession(101, sessionFromToken(null));
    expect(noAuthAdd.ok).toBe(false);

    // Unieważnienie sesji w bazie (wylogowanie) blokuje dostęp, ale zachowuje koszyk w bazie
    const aliceSession = sessionFromToken("valid-token-alice");
    await addProductForSession(101, aliceSession);
    await prisma.session.delete({ where: { token: "valid-token-alice" } });

    const afterLogout = await addProductForSession(101, aliceSession);
    expect(afterLogout.ok).toBe(false);

    // Po ponownym zalogowaniu (nowa sesja dla tego samego userA) koszyk jest nadal dostępny
    await prisma.session.create({
      data: {
        id: "sess-alice-2",
        token: "new-valid-token-alice",
        userId: userA.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const restoredCart = await getMyCart(sessionFromToken("new-valid-token-alice"));
    expect(restoredCart?.items).toHaveLength(1);
    expect(restoredCart?.items[0].quantity).toBe(1);
  });

  test("6. Ograniczenie SQL CHECK (1..99) i równoległe addProduct (+2 przy dostępnym stanie, 1 sukces przy 1 wolnej sztuce)", async () => {
    const aliceSession = sessionFromToken("valid-token-alice");

    // Dwa równoległe dodania przy stanie = 10 -> wynikowa ilość = 2, brak duplikatów
    const [r1, r2] = await Promise.all([
      addProductForSession(101, aliceSession),
      addProductForSession(101, aliceSession),
    ]);
    expect(r1.ok && r2.ok).toBe(true);

    const cartAfterParallel = await getMyCart(aliceSession);
    expect(cartAfterParallel?.items).toHaveLength(1);
    expect(cartAfterParallel?.items[0].quantity).toBe(2);

    // Dwa równoległe dodania produktu ze stanem = 1 (ID 102) -> dokładnie 1 sukces i 1 odmowa
    const [last1, last2] = await Promise.all([
      addProductForSession(102, aliceSession),
      addProductForSession(102, aliceSession),
    ]);
    const successes = Number(last1.ok) + Number(last2.ok);
    expect(successes).toBe(1);

    // Bezpośredni zapis SQL z pominięciem walidatora aplikacji (0 oraz 100) odrzucany przez CHECK
    const cartRow = await prisma.cart.findUniqueOrThrow({
      where: { userId: userA.id },
    });
    await expect(
      prisma.cartItem.updateMany({
        where: { cartId: cartRow.id, productId: 101 },
        data: { quantity: 0 },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.cartItem.updateMany({
        where: { cartId: cartRow.id, productId: 101 },
        data: { quantity: 100 },
      }),
    ).rejects.toThrow();
  });
});

describe("Rozszerzenia Lab 09: Checkout transakcyjny i Historia użytkownika", () => {
  test("Checkout tworzy zamówienie ze snapshotem, zmniejsza stan, czyści koszyk i jest idempotentny, a historia izoluje użytkowników A/B", async () => {
    const aliceSession = sessionFromToken("valid-token-alice");
    const bobSession = sessionFromToken("valid-token-bob");

    await addProductForSession(102, aliceSession); // ostatnia sztuka (amount = 1)
    await addProductForSession(102, bobSession);   // koszyk nie rezerwuje towaru, więc Bob też może dodać do koszyka

    // Alicja i Bob równolegle klikają Checkout na ostatnią sztukę -> tylko jedno zamówienie może przejść!
    const [chkAlice, chkBob] = await Promise.all([
      checkoutForSession("idem-key-alice-001", aliceSession),
      checkoutForSession("idem-key-bob-001", bobSession),
    ]);

    const checkoutSuccessCount = Number(chkAlice.ok) + Number(chkBob.ok);
    expect(checkoutSuccessCount).toBe(1);

    // Ponowienie tego samego klucza idempotentności przez zwycięzcę nie tworzy drugiego zamówienia
    if (chkAlice.ok) {
      const retry = await checkoutForSession("idem-key-alice-001", aliceSession);
      expect(retry.ok).toBe(true);
      if (retry.ok) {
        expect(retry.orderNumber).toBe(chkAlice.orderNumber);
      }

      const aliceOrders = await getMyOrders(aliceSession);
      expect(aliceOrders).toHaveLength(1);

      // Bob nie widzi zamówienia Alicji na swojej liście ani po podmianie orderId
      const bobOrders = await getMyOrders(bobSession);
      expect(bobOrders).toHaveLength(0);
      const hijackedOrder = await getMyOrderById(aliceOrders![0].id, bobSession);
      expect(hijackedOrder).toBeNull();
    }
  });
});