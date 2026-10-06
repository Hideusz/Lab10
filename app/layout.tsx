import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sklep Komputerowy",
  description: "Projekt laboratorium z Programowania BackEnd",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <header>
          <nav>
            <Link href="/">Strona Główna</Link>
            <Link href="/product-list">Katalog produktów</Link>
            <Link href="/basket">Koszyk</Link>
            <Link href="/order-history">Historia</Link>
            <Link href="/about">O nas</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <p>&copy; 2026 Sklep komputerowy. Klatka Artur 14K2, M-07.</p>
        </footer>
      </body>
    </html>
  );
}