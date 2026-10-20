import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Sklep Komputerowy",
  description: "Projekt laboratorium z Programowania BackEnd",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <header>
          <Navigation />
        </header>
        <main>{children}</main>
        {modal}
        <footer>
          <p>&copy; 2026 Sklep komputerowy. Klatka Artur 14K2, M-07.</p>
        </footer>
      </body>
    </html>
  );
}