"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CartItemDTO, CartViewDTO } from "@/lib/cart";
import {
  checkoutAction,
  removeItemAction,
  setQuantityAction,
} from "@/app/basket/actions";

function BasketRow({ item }: { item: CartItemDTO }) {
  const router = useRouter();
  const [quantityInput, setQuantityInput] = useState(String(item.quantity));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSaveQuantity = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    const parsed = Number(quantityInput);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 99) {
      setFieldError("Podaj liczbę całkowitą od 1 do 99.");
      return;
    }

    startTransition(async () => {
      const res = await setQuantityAction(item.id, parsed);
      if (!res.ok) {
        setFieldError(res.message);
      } else {
        router.refresh();
      }
    });
  };

  const handleRemove = () => {
    setFieldError(null);
    startTransition(async () => {
      const res = await removeItemAction(item.id);
      if (!res.ok) {
        setFieldError(res.message);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <li
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        padding: "1rem",
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <Image
          src={item.image}
          alt={item.productName}
          width={80}
          height={80}
          style={{ borderRadius: "6px", objectFit: "cover" }}
        />
        <div>
          <Link
            href={`/product-list/${item.productId}`}
            className="text-link"
            style={{ fontWeight: 600, fontSize: "1.1rem" }}
          >
            {item.productName}
          </Link>
          <p style={{ fontSize: "0.9rem", color: "#bdbdbd" }}>
            Cena jedn.: {(item.unitPrice / 100).toFixed(2)} zł | Dostępne:{" "}
            {item.availableStock} szt.
          </p>
          {item.needsStockAdjustment && (
            <p style={{ color: "salmon", fontWeight: 600, fontSize: "0.9rem" }}>
              Uwaga: stan magazynowy spadł ({item.availableStock} szt.). Zmniejsz
              ilość lub usuń pozycję.
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.5rem",
        }}
      >
        <form
          onSubmit={handleSaveQuantity}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
        >
          <label htmlFor={`qty-${item.id}`} style={{ fontSize: "0.9rem" }}>
            Ilość:
          </label>
          <input
            id={`qty-${item.id}`}
            type="number"
            min={1}
            max={99}
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            disabled={isPending}
            style={{
              width: "4.5rem",
              padding: "0.35rem",
              borderRadius: "4px",
              border: "1px solid var(--border-color)",
              background: "#121212",
              color: "var(--text-color)",
            }}
          />
          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: "0.35rem 0.75rem",
              background: "var(--primary-color)",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              fontWeight: 600,
              cursor: isPending ? "wait" : "pointer",
            }}
          >
            {isPending ? "Zapis..." : "Zmień"}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            style={{
              padding: "0.35rem 0.75rem",
              background: "#5a2a2a",
              color: "#fff",
              border: "1px solid salmon",
              borderRadius: "4px",
              cursor: isPending ? "wait" : "pointer",
            }}
          >
            Usuń
          </button>
        </form>

        <p style={{ fontWeight: "bold" }}>
          Wartość: {(item.lineTotal / 100).toFixed(2)} zł
        </p>

        {fieldError && (
          <p role="alert" style={{ color: "salmon", fontSize: "0.85rem" }}>
            {fieldError}
          </p>
        )}
      </div>
    </li>
  );
}

export function BasketClient({ cart }: { cart: CartViewDTO }) {
  const router = useRouter();
  const [isCheckingOut, startCheckout] = useTransition();
  const [checkoutMsg, setCheckoutMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const handleCheckout = () => {
    setCheckoutMsg(null);
    startCheckout(async () => {
      const res = await checkoutAction(idempotencyKey);
      if (res.ok) {
        setCheckoutMsg({
          type: "success",
          text: `Zamówienie ${res.orderNumber} zostało złożone pomyślnie!`,
        });
        setIdempotencyKey(
          `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        );
        router.refresh();
      } else {
        setCheckoutMsg({ type: "error", text: res.message });
      }
    });
  };

  if (cart.items.length === 0) {
    return (
      <div
        style={{
          background: "var(--card-bg)",
          padding: "2rem",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
        }}
      >
        <p>Twój koszyk jest pusty. Suma: 0,00 zł.</p>
        {checkoutMsg && (
          <p
            style={{
              marginTop: "1rem",
              color: checkoutMsg.type === "success" ? "lightgreen" : "salmon",
              fontWeight: 600,
            }}
          >
            {checkoutMsg.text}
          </p>
        )}
        <p style={{ marginTop: "1rem" }}>
          <Link href="/product-list" className="text-link">
            Przejdź do katalogu produktów &rarr;
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <ul
        style={{
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {cart.items.map((item) => (
          <BasketRow key={`${item.id}-${item.quantity}`} item={item} />
        ))}
      </ul>

      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <p style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
            Suma koszyka: {(cart.totalAmount / 100).toFixed(2)} zł
          </p>
          <p style={{ fontSize: "0.85rem", color: "#bdbdbd" }}>
            Ceny wyliczane są na serwerze na podstawie aktualnego katalogu.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={isCheckingOut || cart.hasStockIssues}
          style={{
            padding: "0.75rem 1.5rem",
            background: cart.hasStockIssues ? "#444" : "var(--primary-color)",
            color: cart.hasStockIssues ? "#999" : "#000",
            border: "none",
            borderRadius: "8px",
            fontWeight: 700,
            cursor: cart.hasStockIssues
              ? "not-allowed"
              : isCheckingOut
                ? "wait"
                : "pointer",
          }}
        >
          {isCheckingOut
            ? "Przetwarzanie zamówienia..."
            : "Złóż zamówienie (Checkout)"}
        </button>
      </div>

      {checkoutMsg && (
        <p
          role="status"
          style={{
            color: checkoutMsg.type === "success" ? "lightgreen" : "salmon",
            fontWeight: 600,
          }}
        >
          {checkoutMsg.text}
        </p>
      )}
    </div>
  );
}