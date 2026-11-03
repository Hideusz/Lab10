import "dotenv/config";
import { performance } from "node:perf_hooks";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { nameSortKey } from "../lib/name-sort-key";

const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Brak TEST_DATABASE_URL / DATABASE_URL.");
}

const parsedUrl = new URL(connectionString);
if (parsedUrl.pathname !== "/shop_test_db") {
  throw new Error(
    `Benchmark może działać wyłącznie na bazie testowej /shop_test_db (obecnie: ${parsedUrl.pathname}).`,
  );
}

const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 5);

const pool = new Pool({
  connectionString,
  max: POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

async function prepareTestData() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const cat = await prisma.category.create({
    data: { code: "cpu", name: "Procesory" },
  });

  const products = Array.from({ length: 50 }, (_, i) => {
    const id = i + 1;
    const name = `Procesor Testowy #${String(id).padStart(2, "0")}`;
    return {
      id,
      code: `BENCHCPU${String(id).padStart(2, "0")}`,
      name,
      nameSortKey: nameSortKey(name),
      description: "Dane testowe do pomiaru wydajności i puli połączeń",
      image: "/images/products/cpu.webp",
      price: 100000 + id * 1000,
      amount: id % 5 === 0 ? 0 : 15,
      date: new Date(Date.now() - id * 60_000),
      categoryId: cat.id,
    };
  });

  await prisma.product.createMany({ data: products });
}

async function runSingleCatalogQuery() {
  return prisma.product.findMany({
    where: {
      amount: { gt: 0 },
      category: { code: "cpu" },
    },
    orderBy: [{ nameSortKey: "asc" }, { id: "asc" }],
    include: { category: true },
  });
}

async function measureBatch(label: string, concurrency: number, totalRequests: number) {
  const durations: number[] = [];
  let peakTotal = 0;
  let peakWaiting = 0;
  let peakActive = 0;

  const samplePool = () => {
    const total = pool.totalCount;
    const idle = pool.idleCount;
    const waiting = pool.waitingCount;
    const active = total - idle;
    if (total > peakTotal) peakTotal = total;
    if (waiting > peakWaiting) peakWaiting = waiting;
    if (active > peakActive) peakActive = active;
  };

  const batchStart = performance.now();

  for (let offset = 0; offset < totalRequests; offset += concurrency) {
    const chunkCount = Math.min(concurrency, totalRequests - offset);
    const promises = Array.from({ length: chunkCount }, async () => {
      const t0 = performance.now();
      samplePool();
      await runSingleCatalogQuery();
      samplePool();
      const t1 = performance.now();
      durations.push(t1 - t0);
    });
    await Promise.all(promises);
  }

  const batchTotalMs = performance.now() - batchStart;
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = durations.reduce((acc, v) => acc + v, 0) / durations.length;

  console.log(`\n--- ${label} ---`);
  console.log(
    `Parametry: żądania = ${totalRequests}, współbieżność = ${concurrency}, limit puli max = ${POOL_MAX}`,
  );
  console.log(
    `Czas odpowiedzi [ms]: min = ${sorted[0].toFixed(2)} | avg = ${avg.toFixed(2)} | p50 = ${percentile(sorted, 50).toFixed(2)} | p95 = ${percentile(sorted, 95).toFixed(2)} | max = ${sorted[sorted.length - 1].toFixed(2)}`,
  );
  console.log(`Czas całkowity serii: ${batchTotalMs.toFixed(2)} ms`);
  console.log(
    `Zużycie puli pg.Pool (szczytowe): totalCount = ${peakTotal}/${POOL_MAX}, active = ${peakActive}, waitingCount (kolejka) = ${peakWaiting}, obecne idleCount = ${pool.idleCount}`,
  );
}

async function main() {
  console.log("=== ROZSZERZENIE LAB 10: POMIAR WYDAJNOŚCI I PULI POŁĄCZEŃ ===");
  console.log(`Baza testowa: ${parsedUrl.pathname}, limit puli (DB_POOL_MAX): ${POOL_MAX}`);

  // 1. Pomiar pierwszego uruchomienia (Cold Start - nawiązanie połączenia TCP/TLS i pierwsze zapytanie)
  const coldStartT0 = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const coldStartMs = performance.now() - coldStartT0;
  console.log(`\n1. Pierwsze uruchomienie (Cold Start połączenia): ${coldStartMs.toFixed(2)} ms`);

  await prepareTestData();

  // 2. Kolejne próby sekwencyjne (Warm - współbieżność = 1, 10 żądań)
  await measureBatch("2. Kolejne próby sekwencyjne (Warm, concurrency = 1)", 1, 10);

  // 3. Współbieżne żądania mieszczące się na granicy puli (concurrency = 10, 30 żądań)
  await measureBatch("3. Ruch współbieżny umiarkowany (concurrency = 10)", 10, 30);

  // 4. Ruch współbieżny przekraczający limit puli (concurrency = 25, 50 żądań -> widoczna kolejka waitingCount)
  await measureBatch("4. Ruch współbieżny wysoki (concurrency = 25)", 25, 50);
}

main()
  .catch((err) => {
    console.error("Błąd podczas benchmarku:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });