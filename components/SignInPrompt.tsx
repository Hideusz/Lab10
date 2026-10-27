"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInPrompt({ message }: { message: string }) {
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/basket",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        padding: "2rem",
      }}
    >
      <p style={{ marginBottom: "1rem" }}>{message}</p>
      <button
        type="button"
        onClick={handleLogin}
        disabled={busy}
        style={{
          padding: "0.6rem 1.4rem",
          backgroundColor: "var(--primary-color)",
          color: "#000",
          border: "none",
          borderRadius: "8px",
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Przekierowanie do GitHub..." : "Zaloguj się przez GitHub"}
      </button>
    </div>
  );
}