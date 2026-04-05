-- ============================================================
-- Migration 021: Fix products table — remove legacy NOT NULL columns
-- ============================================================
-- The live D1 database's products table still carries legacy columns
-- from an earlier schema version (idea TEXT NOT NULL, notes, current_version)
-- that are no longer used by the application code.
--
-- The current INSERT statements (nexus-storage, nexus-workflow, nexus-router)
-- do not supply the 'idea' column, which causes:
--   D1_ERROR: NOT NULL constraint failed: products.idea
--   SQLITE_CONSTRAINT / SQLITE_CONSTRAINT_NOTNULL
--
-- Migration 018 was supposed to fix this via table recreation, but it was
-- skipped on the live DB because the migration name was already recorded
-- from an earlier ALTER TABLE version (PR #117).
--
-- This migration recreates the products table with the correct schema
-- that matches the application code, dropping the legacy columns.
-- ============================================================

-- 1. Drop any leftover temp table from a previous partial run
DROP TABLE IF EXISTS _products_021;

-- 2. Create new table with the correct schema (matches application code)
CREATE TABLE _products_021 (
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
INSERT OR IGNORE INTO _products_021 (id, domain_id, category_id, name, slug, niche, language, user_input, batch_id, status, created_at, updated_at)
  SELECT id, domain_id, category_id, name, slug, niche, language, user_input, batch_id, status, created_at, updated_at
  FROM products;

-- 4. Replace old table
DROP TABLE IF EXISTS products;
ALTER TABLE _products_021 RENAME TO products;

-- 5. Recreate indexes (dropped with the old table)
CREATE INDEX IF NOT EXISTS idx_products_domain_id ON products(domain_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_batch_id ON products(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
