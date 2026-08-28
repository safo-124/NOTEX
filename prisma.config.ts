import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 does not load env files itself, and dotenv's default is `.env`.
// Next.js keeps local secrets in `.env.local`, so load that first: given an
// array, the earlier file wins for any key it defines.
config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma 7 keeps the connection URL here, not in schema.prisma. Migrations
    // go straight to Postgres on 5432, bypassing PgBouncer.
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
  },
});
