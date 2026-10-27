import { connection } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getMyCart } from "@/lib/cart";
import { BasketClient } from "@/components/BasketClient";
import { SignInPrompt } from "@/components/SignInPrompt";

export default async function BasketPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session?.user) {
    return (
      <div>
        <h1>Twój koszyk</h1>
        <SignInPrompt message="Zaloguj się przez GitHub, aby wyświetlić swój indywidualny koszyk i zarządzać zakupami." />
      </div>
    );
  }

  const cart = await getMyCart();

  return (
    <div>
      <h1>Twój koszyk</h1>
      <BasketClient
        cart={cart ?? { items: [], totalAmount: 0, hasStockIssues: false }}
      />
    </div>
  );
}