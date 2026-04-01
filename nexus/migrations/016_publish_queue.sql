-- ============================================================
-- Phase 1: Auto-Publish to Etsy — Publish Queue
-- Adds a publish queue for automatic platform publishing
-- with retry logic and status tracking.
-- ============================================================

-- Publish queue: tracks pending/in-progress/completed platform publishes
CREATE TABLE IF NOT EXISTS publish_queue (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL,      -- 'etsy', 'gumroad', 'pinterest', etc.
  status        TEXT DEFAULT 'pending',  -- pending, publishing, published, failed
  attempts      INTEGER DEFAULT 0,
  max_attempts  INTEGER DEFAULT 3,
  external_id   TEXT,               -- listing ID on external platform
  external_url  TEXT,               -- URL to the listing
  error         TEXT,               -- last error message
  created_at    TEXT DEFAULT (datetime('now')),
  published_at  TEXT
);

-- Indexes for publish queue
CREATE INDEX IF NOT EXISTS idx_publish_queue_product_id ON publish_queue(product_id);
CREATE INDEX IF NOT EXISTS idx_publish_queue_status ON publish_queue(status);
CREATE INDEX IF NOT EXISTS idx_publish_queue_platform ON publish_queue(platform);

-- Add external tracking columns to platform_variants
-- These track the published listing on the external platform
ALTER TABLE platform_variants ADD COLUMN external_id TEXT;
ALTER TABLE platform_variants ADD COLUMN external_url TEXT;
ALTER TABLE platform_variants ADD COLUMN publish_error TEXT;
ALTER TABLE platform_variants ADD COLUMN published_via TEXT DEFAULT 'manual';
