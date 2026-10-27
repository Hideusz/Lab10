"use server";

import { revalidatePath } from "next/cache";
import {
  addProductForSession,
  checkoutForSession,
  removeItemForSession,
  setQuantityForSession,
  type CartMutationResult,
} from "@/lib/cart";

export async function addProductAction(
  productId: number,
): Promise<CartMutationResult> {
  const cleanProductId = Number(productId);
  const result = await addProductForSession(cleanProductId);
  if (result.ok) {
    revalidatePath("/basket");
    revalidatePath("/product-list");
  }
  return result;
}

export async function setQuantityAction(
  itemId: number,
  quantity: number,
): Promise<CartMutationResult> {
  const cleanItemId = Number(itemId);
  const cleanQuantity = Number(quantity);
  const result = await setQuantityForSession(cleanItemId, cleanQuantity);
  if (result.ok) {
    revalidatePath("/basket");
  }
  return result;
}

export async function removeItemAction(
  itemId: number,
): Promise<CartMutationResult> {
  const cleanItemId = Number(itemId);
  const result = await removeItemForSession(cleanItemId);
  if (result.ok) {
    revalidatePath("/basket");
  }
  return result;
}

export async function checkoutAction(
  idempotencyKey: string,
): Promise<CartMutationResult> {
  const result = await checkoutForSession(String(idempotencyKey ?? ""));
  if (result.ok) {
    revalidatePath("/basket");
    revalidatePath("/order-history");
    revalidatePath("/product-list");
  }
  return result;
}