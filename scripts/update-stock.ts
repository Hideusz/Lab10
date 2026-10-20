
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const productId = Number(process.argv[2]);
const amount = Number(process.argv[3]);

if (
  !Number.isSafeInteger(productId) ||
  productId < 1 ||
  productId > 2147483647
) {
  console.error("Podaj poprawne ID produktu (liczba całkowita dodatnia).");
  process.exitCode = 1;
} else if (
  !Number.isSafeInteger(amount) ||
  amount < 0 ||
  amount > 2147483647
) {
  console.error("Ilość musi być liczbą całkowitą od 0 do 2147483647.");
  process.exitCode = 1;
} else {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("Brak DATABASE_URL w pliku .env.");
    process.exitCode = 1;
  } else {
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    try {
      const result = await prisma.product.updateMany({
        where: { id: productId },
        data: { amount },
      });

      if (result.count !== 1) {
        console.error(
          `Oczekiwano zmiany jednego produktu, zmieniono: ${result.count}.`
        );
        process.exitCode = 1;
      } else {
        console.log(`Produkt ${productId}: stan magazynowy ustawiono na ${amount}.`);
      }
    } catch (error) {
      console.error("Nie udało się zaktualizować produktu:", error);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  }
}
