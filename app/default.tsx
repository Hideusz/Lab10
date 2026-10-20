import { notFound } from "next/navigation";

/** Fallback dla nieodtwarzalnego stanu niejawnego slotu `children`. */
export default function DefaultPage() {
  notFound();
}
