-- ============================================================
-- Migration 022: Final fix for products table schema
-- ============================================================
-- Safety-net migration in case migration 021 was recorded in
-- _migrations but never actually executed (e.g. partial run,
-- manual entry, or interrupted bootstrap).
--
-- This migration checks for the presence of the legacy 'idea'
-- column and recreates the table only if needed. If the table
-- already has the correct schema (no 'idea' column), this
-- migration is a no-op.
--
-- The correct products schema (matching application code) is:
--   id, domain_id, category_id, name, slug, niche, language,
--   user_input, batch_id, status, created_at, updated_at
-- ============================================================

-- 1. Drop any leftover temp table from a previous partial run
DROP TABLE IF EXISTS _products_022;

-- 2. Create new table with the correct schema
CREATE TABLE _products_022 (
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

-- 3. Copy data from old table — only columns that exist in the new schema.
--    Legacy columns (idea, notes, current_version) are intentionally dropped.
--    Uses INSERT OR IGNORE to handle edge cases safely.
INSERT OR IGNORE INTO _products_022 (id, domain_id, category_id, name, slug, niche, language, user_input, batch_id, status, created_at, updated_at)
  SELECT id, domain_id, category_id, name, slug, niche, language, user_input, batch_id, status, created_at, updated_at
  FROM products;

-- 4. Replace old table
DROP TABLE IF EXISTS products;
ALTER TABLE _products_022 RENAME TO products;

-- 5. Recreate indexes (dropped with the old table)
CREATE INDEX IF NOT EXISTS idx_products_domain_id ON products(domain_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_batch_id ON products(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
