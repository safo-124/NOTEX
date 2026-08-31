import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 requires a driver adapter. `pg` points at PgBouncer in transaction
 * mode, so the pool here stays tiny: each serverless invocation holds one
 * connection and PgBouncer does the real pooling.
 *
 * The client is built lazily. Next collects route configuration at build time
 * by importing every module, so constructing it eagerly would make the build
 * depend on DATABASE_URL being present, which it should not: the URL is only
 * needed when a request actually queries.
 */
const globalForPrisma = globalThis as unknown as { __notexPrisma?: PrismaClient };

function getClient(): PrismaClient {
  if (globalForPrisma.__notexPrisma) return globalForPrisma.__notexPrisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local, or to the project's environment variables.");
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 1, idleTimeoutMillis: 20_000 }),
  });

  globalForPrisma.__notexPrisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  // No `receiver` argument: PrismaClient is itself a proxy that resolves model
  // delegates lazily, and handing it a foreign receiver breaks that lookup.
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, prop) {
    return prop in (getClient() as unknown as object);
  },
});
