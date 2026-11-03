import "server-only";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Brak DATABASE_URL w konfiguracji środowiska.");
}

const poolMax = Number(process.env.DB_POOL_MAX ?? 5);

const globalForPrisma = globalThis as unknown as {
  pgPool?: Pool;
  prisma?: PrismaClient;
};

export const pgPool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
    max: Number.isSafeInteger(poolMax) && poolMax > 0 ? poolMax : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

const adapter = new PrismaPg(pgPool);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pgPool = pgPool;
  globalForPrisma.prisma = prisma;
}

export function getPoolMetrics() {
  return {
    max: pgPool.options.max ?? 5,
    totalCount: pgPool.totalCount,
    idleCount: pgPool.idleCount,
    waitingCount: pgPool.waitingCount,
  };
}