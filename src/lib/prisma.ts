import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 requires a driver adapter. `pg` points at PgBouncer in transaction
 * mode, so the pool here stays tiny: serverless opens one connection per
 * invocation and PgBouncer does the real pooling.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const globalForPrisma = globalThis as unknown as { __notexPrisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({
    connectionString,
    max: 1,
    idleTimeoutMillis: 20_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.__notexPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__notexPrisma = prisma;
