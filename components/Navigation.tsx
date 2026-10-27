"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [authBusy, setAuthBusy] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const navItems = [
    { href: "/", label: "Strona Główna" },
    { href: "/product-list", label: "Katalog produktów" },
    { href: "/basket", label: "Koszyk" },
    { href: "/order-history", label: "Historia" },
    { href: "/about", label: "O nas" },
  ];

  const handleGitHubSignIn = async () => {
    setAuthBusy(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/basket",
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await authClient.signOut();
      router.refresh();
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              style={{
                padding: "0.5rem 1.2rem",
                backgroundColor: active
                  ? "var(--primary-color)"
                  : "var(--button-bg)",
                color: active ? "#000" : "var(--text-color)",
                border: `1px solid ${active ? "var(--primary-color)" : "var(--border-color)"}`,
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "500",
                transition: "all 0.2s ease-in-out",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {isPending ? (
          <span style={{ fontSize: "0.9rem", color: "#bdbdbd" }}>
            Sprawdzanie sesji...
          </span>
        ) : session?.user ? (
          <>
            <span style={{ fontSize: "0.95rem" }}>
              Zalogowano jako:{" "}
              <strong>{session.user.name || session.user.email}</strong>
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={authBusy}
              style={{
                padding: "0.45rem 1rem",
                backgroundColor: "var(--button-bg)",
                color: "var(--text-color)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                cursor: authBusy ? "wait" : "pointer",
              }}
            >
              {authBusy ? "Wylogowywanie..." : "Wyloguj"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleGitHubSignIn}
            disabled={authBusy}
            style={{
              padding: "0.45rem 1rem",
              backgroundColor: "var(--primary-color)",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: authBusy ? "wait" : "pointer",
            }}
          >
            {authBusy ? "Przekierowanie..." : "Zaloguj przez GitHub"}
          </button>
        )}
      </div>
    </div>
  );
}