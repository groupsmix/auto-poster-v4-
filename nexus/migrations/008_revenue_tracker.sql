-- ============================================================
-- NEXUS V4 Migration 008 — Revenue Tracker & Platform Connections
-- Phase 2: The Money Tracker
-- ============================================================

-- Platform connections: OAuth/API key connections to Etsy, Gumroad, Shopify
CREATE TABLE IF NOT EXISTS platform_connections (
  id              TEXT PRIMARY KEY,
  platform        TEXT NOT NULL,
  store_name      TEXT,
  auth_type       TEXT DEFAULT 'api_key',
  api_key         TEXT,
  api_secret      TEXT,
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TEXT,
  shop_domain     TEXT,
  is_active       BOOLEAN DEFAULT true,
  last_sync_at    TEXT,
  sync_status     TEXT DEFAULT 'idle',
  metadata        JSON,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Revenue records: individual sale/order data mapped to NEXUS products
CREATE TABLE IF NOT EXISTS revenue_records (
  id              TEXT PRIMARY KEY,
  connection_id   TEXT REFERENCES platform_connections(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  product_id      TEXT REFERENCES products(id) ON DELETE SET NULL,
  external_order_id TEXT,
  external_product_id TEXT,
  external_product_title TEXT,
  sku             TEXT,
  quantity        INTEGER DEFAULT 1,
  revenue         REAL NOT NULL DEFAULT 0,
  currency        TEXT DEFAULT 'USD',
  fees            REAL DEFAULT 0,
  net_revenue     REAL DEFAULT 0,
  order_date      TEXT NOT NULL,
  synced_at       TEXT DEFAULT (datetime('now')),
  metadata        JSON
);

-- Revenue daily aggregates for fast dashboard queries
CREATE TABLE IF NOT EXISTS revenue_daily (
  id              TEXT PRIMARY KEY,
  connection_id   TEXT REFERENCES platform_connections(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  domain_id       TEXT REFERENCES domains(id) ON DELETE SET NULL,
  category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
  date            TEXT NOT NULL,
  orders_count    INTEGER DEFAULT 0,
  units_sold      INTEGER DEFAULT 0,
  gross_revenue   REAL DEFAULT 0,
  fees            REAL DEFAULT 0,
  net_revenue     REAL DEFAULT 0,
  views           INTEGER DEFAULT 0,
  favorites       INTEGER DEFAULT 0,
  conversion_rate REAL DEFAULT 0,
  currency        TEXT DEFAULT 'USD'
);

-- Indexes for platform connections
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_connections_is_active ON platform_connections(is_active);

-- Indexes for revenue records
CREATE INDEX IF NOT EXISTS idx_revenue_records_connection_id ON revenue_records(connection_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_platform ON revenue_records(platform);
CREATE INDEX IF NOT EXISTS idx_revenue_records_product_id ON revenue_records(product_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_order_date ON revenue_records(order_date);
CREATE INDEX IF NOT EXISTS idx_revenue_records_external_order_id ON revenue_records(external_order_id);

-- Indexes for revenue daily
CREATE INDEX IF NOT EXISTS idx_revenue_daily_platform ON revenue_daily(platform);
CREATE INDEX IF NOT EXISTS idx_revenue_daily_domain_id ON revenue_daily(domain_id);
CREATE INDEX IF NOT EXISTS idx_revenue_daily_category_id ON revenue_daily(category_id);
CREATE INDEX IF NOT EXISTS idx_revenue_daily_date ON revenue_daily(date);
CREATE INDEX IF NOT EXISTS idx_revenue_daily_connection_id ON revenue_daily(connection_id);

-- Unique constraint on daily aggregates
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_daily_unique 
  ON revenue_daily(connection_id, platform, domain_id, category_id, date);
