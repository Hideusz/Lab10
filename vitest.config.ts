
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Brak DATABASE_URL. Ustaw połączenie z bazą testową.");
}

const testDatabaseUrl = new URL(databaseUrl);

if (testDatabaseUrl.pathname !== "/shop_test_db") {
  throw new Error(
    "Testy wymagają bazy shop_test_db. Ustaw DATABASE_URL na bazę testową przed uruchomieniem."
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
