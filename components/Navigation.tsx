"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

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

  return (
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
              backgroundColor: active ? "var(--primary-color)" : "var(--button-bg)",
              color: active ? "#000" : "var(--text-color)",
              border: `1px solid ${active ? "var(--primary-color)" : "var(--border-color)"}`,
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "500",
              transition: "all 0.2s ease-in-out"
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}