-- Run once, after the migration that adds note."searchVector".
--
--   ssh -N -L 5433:127.0.0.1:5432 safo@135.181.93.156     (in one window)
--   psql "postgres://notex:PASSWORD@127.0.0.1:5433/notex" -f scripts/search-index.sql
--
-- Prisma creates the column but not the index: a GIN index on a tsvector is
-- beyond what the schema language can express.

CREATE INDEX IF NOT EXISTS note_search_idx ON "note" USING GIN ("searchVector");

-- Backfill anything written before the column existed.
UPDATE "note"
SET "searchVector" =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(body, '')), 'B')
WHERE "searchVector" IS NULL;
