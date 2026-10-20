export function nameSortKey(name: string): string {
  return Buffer.from(name, "utf8").toString("hex");
}