import "server-only";
import { prisma } from "./prisma";
import { getCurrentSession } from "./auth";

export type CartItemDTO = {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  image: string;
  unitPrice: number; // w groszach (z aktualnego katalogu)
  quantity: number;
  availableStock: number;
  lineTotal: number; // w groszach
  needsStockAdjustment: boolean;
};

export type CartViewDTO = {
  items: CartItemDTO[];
  totalAmount: number; // w groszach
  hasStockIssues: boolean;
};

export type CartMutationResult =
  | { ok: true; cart?: CartViewDTO; orderNumber?: string }
  | {
      ok: false;
      code:
        | "UNAUTHORIZED"
        | "INVALID_INPUT"
        | "NOT_FOUND"
        | "OUT_OF_STOCK"
        | "LIMIT_EXCEEDED"
        | "EMPTY_CART";
      message: string;
    };

export type OrderItemDTO = {
  id: number;
  productId: number | null;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: string; // BigInt jako string w groszach
};

export type OrderDTO = {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: string; // BigInt jako string w groszach
  createdAt: string;
  items: OrderItemDTO[];
};

function isValidId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= 2147483647
  );
}

function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= 99
  );
}

async function resolveAuthenticatedUserId(
  overrideSessionGetter?: () => Promise<{ user: { id: string } } | null>,
): Promise<string | null> {
  const session = overrideSessionGetter
    ? await overrideSessionGetter()
    : await getCurrentSession();
  const userId = session?.user?.id;
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return null;
  }
  return userId;
}

/**
 * Odczyt koszyka dla podanego userId (wewnętrzny helper po weryfikacji sesji).
 */
export async function getCartForUser(userId: string): Promise<CartViewDTO> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              image: true,
              price: true,
              amount: true,
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return { items: [], totalAmount: 0, hasStockIssues: false };
  }

  let totalAmount = 0;
  let hasStockIssues = false;

  const items: CartItemDTO[] = cart.items.map((item) => {
    const unitPrice = item.product.price;
    const lineTotal = unitPrice * item.quantity;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new Error("Przekroczono bezpieczny zakres obliczeń pozycji koszyka.");
    }
    totalAmount += lineTotal;
    if (!Number.isSafeInteger(totalAmount)) {
      throw new Error("Przekroczono bezpieczny zakres sumy koszyka.");
    }

    const needsStockAdjustment =
      item.product.amount === 0 || item.quantity > item.product.amount;
    if (needsStockAdjustment) {
      hasStockIssues = true;
    }

    return {
      id: item.id,
      productId: item.product.id,
      productCode: item.product.code,
      productName: item.product.name,
      image: item.product.image,
      unitPrice,
      quantity: item.quantity,
      availableStock: item.product.amount,
      lineTotal,
      needsStockAdjustment,
    };
  });

  return { items, totalAmount, hasStockIssues };
}

/**
 * Tabela 5.1: getMyCart()
 * Ustala właściciela wyłącznie z sesji bieżącego żądania na serwerze.
 */
export async function getMyCart(
  overrideSessionGetter?: () => Promise<{ user: { id: string } } | null>,
): Promise<CartViewDTO | null> {
  const userId = await resolveAuthenticatedUserId(overrideSessionGetter);
  if (!userId) {
    return null;
  }
  return getCartForUser(userId);
}

/**
 * Tabela 5.1: addProduct(productId)
 * Atomowe dodanie 1 sztuki produktu do koszyka zalogowanego użytkownika.
 * Używa blokady wiersza produktu (SELECT ... FOR UPDATE) w transakcji, aby dwa równoległe
 * wywołania poprawnie zwiększały ilość o +2 lub odrzucały drugie żądanie przy braku stanu / limicie 99.
 */
export async function addProductForSession(
  productId: number,
  overrideSessionGetter?: () => Promise<{ user: { id: string } } | null>,
): Promise<CartMutationResult> {
  const userId = await resolveAuthenticatedUserId(overrideSessionGetter);
  if (!userId) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Musisz być zalogowany, aby dodać produkt do koszyka.",
    };
  }

  if (!isValidId(productId)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Nieprawidłowy identyfikator produktu.",
    };
  }

  return prisma.$transaction(async (tx) => {
    // Blokujemy wiersz produktu na czas transakcji, aby zserializować równoległe dodania tego samego produktu
    const productRows = await tx.$queryRaw<
      Array<{ id: number; amount: number }>
    >`SELECT "id", "amount" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;

    const product = productRows[0];
    if (!product) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Wybrany produkt nie istnieje.",
      };
    }

    if (product.amount <= 0) {
      return {
        ok: false,
        code: "OUT_OF_STOCK",
        message: "Produkt jest obecnie niedostępny w magazynie.",
      };
    }

    // Koszyk tworzymy dopiero przy pierwszym zapisie (upsert po unikalnym userId)
    const cart = await tx.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const existing = await tx.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    const nextQuantity = (existing?.quantity ?? 0) + 1;

    if (nextQuantity > 99) {
      return {
        ok: false,
        code: "LIMIT_EXCEEDED",
        message: "Maksymalna ilość jednego produktu w koszyku to 99 sztuk.",
      };
    }

    if (nextQuantity > product.amount) {
      return {
        ok: false,
        code: "OUT_OF_STOCK",
        message: `Dostępna ilość w magazynie to tylko ${product.amount} szt.`,
      };
    }

    if (!existing) {
      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity: 1,
        },
      });
    } else {
      const updated = await tx.cartItem.updateMany({
        where: {
          id: existing.id,
          cart: { userId },
          quantity: { lt: Math.min(99, product.amount) },
        },
        data: {
          quantity: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        return {
          ok: false,
          code: "OUT_OF_STOCK",
          message: "Nie można zwiększyć ilości ponad dostępny stan lub limit 99.",
        };
      }
    }

    return { ok: true };
  });
}

/**
 * Tabela 5.1: setQuantity(itemId, quantity)
 * Ustawia zwalidowaną ilość (1..99 i <= Product.amount) wyłącznie we własnej pozycji koszyka.
 */
export async function setQuantityForSession(
  itemId: number,
  quantity: number,
  overrideSessionGetter?: () => Promise<{ user: { id: string } } | null>,
): Promise<CartMutationResult> {
  const userId = await resolveAuthenticatedUserId(overrideSessionGetter);
  if (!userId) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Musisz być zalogowany, aby zmienić ilość w koszyku.",
    };
  }

  if (!isValidId(itemId) || !isValidQuantity(quantity)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Ilość musi być liczbą całkowitą z zakresu od 1 do 99.",
    };
  }

  return prisma.$transaction(async (tx) => {
    // Jednoczesne sprawdzenie ID pozycji oraz właściciela koszyka (userId z sesji)
    const item = await tx.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: {
        product: {
          select: { id: true, amount: true },
        },
      },
    });

    if (!item) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Nie znaleziono pozycji w Twoim koszyku.",
      };
    }

    if (item.product.amount <= 0 || quantity > item.product.amount) {
      return {
        ok: false,
        code: "OUT_OF_STOCK",
        message:
          item.product.amount <= 0
            ? "Produkt stał się niedostępny. Usuń pozycję z koszyka."
            : `Nie można ustawić ${quantity} szt. Dostępne w magazynie: ${item.product.amount} szt.`,
      };
    }

    const updated = await tx.cartItem.updateMany({
      where: {
        id: itemId,
        cart: { userId },
      },
      data: { quantity },
    });

    if (updated.count !== 1) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Nie znaleziono pozycji w Twoim koszyku.",
      };
    }

    return { ok: true };
  });
}

/**
 * Tabela 5.1: removeItem(itemId)
 * Usuwa pozycję wyłącznie z własnego koszyka (sprawdzenie id oraz cart.userId w jednym zapytaniu).
 */
export async function removeItemForSession(
  itemId: number,
  overrideSessionGetter?: () => Promise<{ user: { id: string } } | null>,
): Promise<CartMutationResult> {
  const userId = await resolveAuthenticatedUserId(overrideSessionGetter);
  if (!userId) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Musisz być zalogowany, aby usunąć pozycję z koszyka.",
    };
  }

  if (!isValidId(itemId)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Nieprawidłowy identyfikator pozycji koszyka.",
    };
  }

  const deleted = await prisma.cartItem.deleteMany({
    where: {
      id: itemId,
      cart: { userId },
    },
  });

  if (deleted.count !== 1) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Nie znaleziono pozycji w Twoim koszyku.",
    };
  }

  return { ok: true };
}

/**
 * Rozszerzenie Lab 09: Checkout transakcyjny
 * W jednej transakcji sprawdza właściciela, ceny i stan, warunkowo zmniejsza Product.amount,
 * zapisuje zamówienie ze snapshotem w groszach (BigInt), obsługuje idempotencyKey i czyści koszyk.
 */
export async function checkoutForSession(
  idempotencyKey: string,
  overrideSessionGetter?: () => Promise<{ user: { id: string } } | null>,
): Promise<CartMutationResult> {
  const userId = await resolveAuthenticatedUserId(overrideSessionGetter);
  if (!userId) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Musisz być zalogowany, aby złożyć zamówienie.",
    };
  }

  const cleanKey = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
  if (cleanKey.length < 8 || cleanKey.length > 128) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Nieprawidłowy klucz żądania zamówienia.",
    };
  }

  const scopedKey = `${userId}:${cleanKey}`;

  return prisma.$transaction(async (tx): Promise<CartMutationResult> => {
    // Jeśli to samo żądanie zostało już przetworzone, zwracamy istniejące zamówienie bez duplikatu
    const existingOrder = await tx.order.findUnique({
      where: { idempotencyKey: scopedKey },
    });
    if (existingOrder) {
      return { ok: true, orderNumber: existingOrder.orderNumber };
    }

    const cart = await tx.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { productId: "asc" },
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return {
        ok: false,
        code: "EMPTY_CART",
        message: "Twój koszyk jest pusty.",
      };
    }

    // Warunkowe zmniejszenie stanu każdego produktu; jeśli brakuje chociaż jednej sztuki, wycofujemy transakcję
    let totalAmount = BigInt(0);
    const orderItemsData: Array<{
      productId: number;
      productCode: string;
      productName: string;
      unitPrice: number;
      quantity: number;
      lineTotal: bigint;
    }> = [];

    for (const item of cart.items) {
      const decremented = await tx.product.updateMany({
        where: {
          id: item.productId,
          amount: { gte: item.quantity },
        },
        data: {
          amount: { decrement: item.quantity },
        },
      });

      if (decremented.count !== 1) {
        throw new Error(`INSUFFICIENT_STOCK:${item.product.name}`);
      }

      // Pobieramy aktualne dane produktu po zablokowaniu wiersza do snapshotu
      const currentProduct = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
      });

      const lineTotal = BigInt(currentProduct.price) * BigInt(item.quantity);
      totalAmount += lineTotal;

      orderItemsData.push({
        productId: currentProduct.id,
        productCode: currentProduct.code,
        productName: currentProduct.name,
        unitPrice: currentProduct.price,
        quantity: item.quantity,
        lineTotal,
      });
    }

    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `ORD-${Date.now()}-${randomSuffix}`;

    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        idempotencyKey: scopedKey,
        userId,
        status: "PAID",
        totalAmount,
        items: {
          create: orderItemsData,
        },
      },
    });

    // Wyczyść pozycje właściwego koszyka
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { ok: true, orderNumber: createdOrder.orderNumber };
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message.startsWith("INSUFFICIENT_STOCK:")) {
      const prodName = err.message.replace("INSUFFICIENT_STOCK:", "");
      return {
        ok: false as const,
        code: "OUT_OF_STOCK" as const,
        message: `Brak wystarczającej ilości produktu "${prodName}" w magazynie.`,
      };
    }
    throw err;
  });
}

/**
 * Rozszerzenie Lab 09: Historia użytkownika
 * Zwraca wyłącznie zamówienia należące do aktualnie zalogowanego użytkownika.
 */
export async function getMyOrders(
  overrideSessionGetter?: () => Promise<{ user: { id: string } } | null>,
): Promise<OrderDTO[] | null> {
  const userId = await resolveAuthenticatedUserId(overrideSessionGetter);
  if (!userId) {
    return null;
  }

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      items: {
        orderBy: { id: "asc" },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount.toString(),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal.toString(),
    })),
  }));
}

/**
 * Odczyt pojedynczego zamówienia z weryfikacją właściciela (userId z sesji).
 * Próba odczytu cudzego zamówienia przez podmianę orderId zwraca null.
 */
export async function getMyOrderById(
  orderId: number,
  overrideSessionGetter?: () => Promise<{ user: { id: string } } | null>,
): Promise<OrderDTO | null> {
  const userId = await resolveAuthenticatedUserId(overrideSessionGetter);
  if (!userId || !isValidId(orderId)) {
    return null;
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
    },
    include: {
      items: { orderBy: { id: "asc" } },
    },
  });

  if (!order) {
    return null;
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount.toString(),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal.toString(),
    })),
  };
}