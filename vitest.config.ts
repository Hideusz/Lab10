import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!testUrl) {
  throw new Error("Brak TEST_DATABASE_URL / DATABASE_URL. Ustaw połączenie z bazą testową.");
}

const parsedUrl = new URL(testUrl);

if (parsedUrl.pathname !== "/shop_test_db") {
  throw new Error(
    `Testy wymagają bazy /shop_test_db (otrzymano: ${parsedUrl.pathname}). Ustaw TEST_DATABASE_URL w .env.`
  );
}

process.env.DATABASE_URL = testUrl;

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    fileParallelism: false,
  },
});