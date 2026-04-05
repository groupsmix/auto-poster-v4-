-- ============================================================
-- Migration 018: Fix products table — ensure name & slug columns exist
-- ============================================================
-- Some D1 databases are missing the 'name' and 'slug' columns on the
-- products table, causing:
--   D1_ERROR: table products has no column named name: SQLITE_ERROR
--
-- Root cause: if the initial schema was partially applied, or the
-- database was recreated without re-running all migrations, the
-- products table may lack these columns even though the application
-- code (nexus-storage, nexus-workflow, nexus-router) references them.
--
-- Uses the table-recreation pattern (same as migration 003) to
-- guarantee the correct schema regardless of current state.
-- This is safe for both fresh databases (empty table) and broken
-- databases (missing columns).
-- ============================================================

-- 1. Drop any leftover temp table from a previous partial run
DROP TABLE IF EXISTS _products_018;

-- 2. Create new table with the full correct schema
CREATE TABLE _products_018 (
  id            TEXT PRIMARY KEY,
  domain_id     TEXT REFERENCES domains(id) ON DELETE CASCADE,
  category_id   TEXT REFERENCES categories(id) ON DELETE CASCADE,
  name          TEXT,
  slug          TEXT,
  niche         TEXT,
  language      TEXT DEFAULT 'en',
  user_input    JSON,
  batch_id      TEXT,
  status        TEXT DEFAULT 'draft',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT
);

-- 3. Copy data using only columns guaranteed to exist in all variants.
--    name & slug will be NULL for rows where the source table lacked them.
INSERT OR IGNORE INTO _products_018 (id, domain_id, category_id, niche, language, user_input, batch_id, status, created_at, updated_at)
  SELECT id, domain_id, category_id, niche, language, user_input, batch_id, status, created_at, updated_at
  FROM products;

-- 4. Replace old table
DROP TABLE IF EXISTS products;
ALTER TABLE _products_018 RENAME TO products;

-- 5. Recreate indexes (dropped with the old table)
CREATE INDEX IF NOT EXISTS idx_products_domain_id ON products(domain_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_batch_id ON products(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
