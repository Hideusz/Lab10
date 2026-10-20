import { notFound } from "next/navigation";
import { getProductById } from "@/lib/repository";

/**
 * Waliduje identyfikator pochodzący z segmentu URL i odczytuje produkt.
 * Nie przechwytuje awarii repozytorium — wyjątek powinien trafić do error.tsx.
 */
export async function getProductForRoute(idValue: string) {
  if (!/^[1-9]\d*$/.test(idValue)) {
    notFound();
  }

  const id = Number(idValue);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    notFound();
  }

  const product = await getProductById(id);
  if (!product) {
    notFound();
  }

  return product;
}
