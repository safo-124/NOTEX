/**
 * Applies scripts/search-index.sql without needing psql installed.
 *
 *   npm run db:search-index          (with the SSH tunnel open)
 *
 * Prisma can create the tsvector column but not a GIN index on it, so this is
 * the one piece of schema that lives in SQL.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: [".env.local", ".env"] });

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL_DIRECT is not set. Check .env.local.");
    process.exit(1);
  }

  const sql = readFileSync(join(process.cwd(), "scripts", "search-index.sql"), "utf8");
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
  } catch (err) {
    console.error(
      `Could not connect: ${err instanceof Error ? err.message : err}\n` +
        "Is the SSH tunnel open?  ssh -N -L 5433:127.0.0.1:5432 safo@your-vps",
    );
    process.exit(1);
  }

  try {
    await client.query(sql);
    const { rows } = await client.query(
      `SELECT count(*)::int AS indexed FROM "note" WHERE "searchVector" IS NOT NULL`,
    );
    console.log(`Index created. ${rows[0].indexed} notes indexed.`);
  } catch (err) {
    console.error(`Failed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
