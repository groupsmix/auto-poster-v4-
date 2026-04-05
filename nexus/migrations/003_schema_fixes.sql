-- ============================================================
-- NEXUS V4: Schema Fixes
-- 9.2: Add created_at and updated_at to categories table
-- 9.5: Add ON DELETE CASCADE to foreign keys
-- Made idempotent: safe to re-run on existing databases.
-- ============================================================

-- 9.2: Add timestamp columns to categories (idempotent — D1 ignores duplicate ADD COLUMN)
ALTER TABLE categories ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE categories ADD COLUMN updated_at TEXT;

-- 9.5: Fix foreign keys missing ON DELETE CASCADE
-- SQLite doesn't support ALTER TABLE to modify constraints,
-- so we recreate affected tables with proper CASCADE rules.
-- Using IF NOT EXISTS + INSERT OR IGNORE + DROP IF EXISTS for idempotency.

-- Fix products: add CASCADE on domain_id and category_id
CREATE TABLE IF NOT EXISTS products_new (
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

INSERT OR IGNORE INTO products_new SELECT * FROM products;
DROP TABLE IF EXISTS products;
ALTER TABLE products_new RENAME TO products;

-- Recreate products indexes
CREATE INDEX IF NOT EXISTS idx_products_domain_id ON products(domain_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_batch_id ON products(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Fix platform_variants: add CASCADE on platform_id
CREATE TABLE IF NOT EXISTS platform_variants_new (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  platform_id   TEXT REFERENCES platforms(id) ON DELETE CASCADE,
  title         TEXT,
  description   TEXT,
  tags          JSON,
  price         REAL,
  metadata      JSON,
  status        TEXT DEFAULT 'draft',
  published_at  TEXT
);

INSERT OR IGNORE INTO platform_variants_new SELECT * FROM platform_variants;
DROP TABLE IF EXISTS platform_variants;
ALTER TABLE platform_variants_new RENAME TO platform_variants;

-- Recreate platform_variants indexes
CREATE INDEX IF NOT EXISTS idx_platform_variants_product_id ON platform_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_platform_variants_platform_id ON platform_variants(platform_id);

-- Fix social_variants: add CASCADE on channel_id
CREATE TABLE IF NOT EXISTS social_variants_new (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  channel_id    TEXT REFERENCES social_channels(id) ON DELETE CASCADE,
  content       JSON,
  status        TEXT DEFAULT 'draft',
  scheduled_at  TEXT,
  published_at  TEXT
);

INSERT OR IGNORE INTO social_variants_new SELECT * FROM social_variants;
DROP TABLE IF EXISTS social_variants;
ALTER TABLE social_variants_new RENAME TO social_variants;

-- Recreate social_variants indexes
CREATE INDEX IF NOT EXISTS idx_social_variants_product_id ON social_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_social_variants_channel_id ON social_variants(channel_id);
