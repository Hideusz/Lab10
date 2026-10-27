"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProductAction } from "@/app/basket/actions";

type Props = {
  productId: number;
  disabled?: boolean;
};

export function AddToCartButton({ productId, disabled }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleAdd = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await addProductAction(productId);
      if (result.ok) {
        setFeedback({ type: "success", text: "Dodano 1 szt. do koszyka." });
        router.refresh();
      } else {
        setFeedback({ type: "error", text: result.message });
      }
    });
  };

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled || isPending}
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: disabled ? "#444" : "var(--primary-color)",
          color: disabled ? "#999" : "#000",
          border: "none",
          borderRadius: "6px",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : isPending ? "wait" : "pointer",
          width: "100%",
        }}
      >
        {isPending
          ? "Dodawanie..."
          : disabled
            ? "Produkt niedostępny"
            : "Dodaj do koszyka"}
      </button>
      {feedback && (
        <p
          role="status"
          style={{
            marginTop: "0.4rem",
            fontSize: "0.85rem",
            color: feedback.type === "success" ? "lightgreen" : "salmon",
          }}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}