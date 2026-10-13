import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

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
          <Navigation />
        </header>
        <main>{children}</main>
        <footer>
          <p>&copy; 2026 Sklep komputerowy. Klatka Artur 14K2, M-07.</p>
        </footer>
      </body>
    </html>
  );
}