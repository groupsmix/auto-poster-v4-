-- ============================================================
-- Migration 017: Six Features
-- A/B Testing, Competitor Pricing, Seasonal Calendar,
-- Bundle Creator, Webhook Alerts, Health Dashboard
-- ============================================================

-- ── A/B Testing ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ab_tests (
  id              TEXT PRIMARY KEY,
  product_id      TEXT REFERENCES products(id) ON DELETE CASCADE,
  platform_id     TEXT,
  status          TEXT DEFAULT 'active',  -- active, completed, cancelled
  winning_variant TEXT,
  started_at      TEXT DEFAULT (datetime('now')),
  ended_at        TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ab_variants (
  id              TEXT PRIMARY KEY,
  test_id         TEXT REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_label   TEXT NOT NULL,  -- A, B, C
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  tags            JSON,
  views           INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  sales           INTEGER DEFAULT 0,
  revenue         REAL DEFAULT 0,
  conversion_rate REAL DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  activated_at    TEXT,
  deactivated_at  TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_product_id ON ab_tests(product_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_variants_test_id ON ab_variants(test_id);

-- ── Competitor Price Monitoring ─────────────────────────────

CREATE TABLE IF NOT EXISTS competitor_prices (
  id              TEXT PRIMARY KEY,
  niche           TEXT NOT NULL,
  platform        TEXT NOT NULL,
  competitor_name TEXT,
  product_title   TEXT NOT NULL,
  product_url     TEXT,
  price           REAL NOT NULL,
  currency        TEXT DEFAULT 'USD',
  scraped_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_rules (
  id              TEXT PRIMARY KEY,
  niche           TEXT NOT NULL,
  platform        TEXT NOT NULL,
  strategy        TEXT DEFAULT 'below_average', -- below_average, match_lowest, custom
  adjustment_pct  REAL DEFAULT -10,             -- e.g. -10 = 10% below
  min_price       REAL DEFAULT 0,
  max_price       REAL DEFAULT 9999,
  is_active       BOOLEAN DEFAULT true,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_competitor_prices_niche ON competitor_prices(niche);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_platform ON competitor_prices(platform);
CREATE INDEX IF NOT EXISTS idx_price_rules_niche ON price_rules(niche);

-- ── Seasonal Calendar ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasonal_events (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  event_date      TEXT NOT NULL,        -- MM-DD or YYYY-MM-DD
  recurring       BOOLEAN DEFAULT true,
  regions         JSON,                 -- ["US","UK","IN",...]
  categories      JSON,                 -- suggested product categories
  keywords        JSON,                 -- suggested niche keywords
  prep_weeks      INTEGER DEFAULT 5,    -- weeks before event to start creating
  priority        TEXT DEFAULT 'medium', -- high, medium, low
  is_active       BOOLEAN DEFAULT true,
  auto_trigger    BOOLEAN DEFAULT false,
  last_triggered  TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seasonal_events_event_date ON seasonal_events(event_date);
CREATE INDEX IF NOT EXISTS idx_seasonal_events_is_active ON seasonal_events(is_active);

-- ── Bundle Creator ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bundles (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  domain_id       TEXT REFERENCES domains(id),
  category_id     TEXT REFERENCES categories(id),
  bundle_price    REAL,
  individual_total REAL DEFAULT 0,
  savings_pct     REAL DEFAULT 0,
  status          TEXT DEFAULT 'draft',  -- draft, active, archived
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bundle_items (
  id              TEXT PRIMARY KEY,
  bundle_id       TEXT REFERENCES bundles(id) ON DELETE CASCADE,
  product_id      TEXT REFERENCES products(id) ON DELETE CASCADE,
  sort_order      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bundles_domain_id ON bundles(domain_id);
CREATE INDEX IF NOT EXISTS idx_bundles_status ON bundles(status);
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON bundle_items(product_id);

-- ── Webhook Alerts ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_configs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  type            TEXT DEFAULT 'discord', -- discord, telegram, custom
  events          JSON DEFAULT '["product_approved","product_published","publish_failed","daily_summary"]',
  is_active       BOOLEAN DEFAULT true,
  last_fired_at   TEXT,
  total_sent       INTEGER DEFAULT 0,
  total_failed     INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id              TEXT PRIMARY KEY,
  config_id       TEXT REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSON,
  status          TEXT DEFAULT 'sent', -- sent, failed
  response_code   INTEGER,
  error           TEXT,
  sent_at         TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_is_active ON webhook_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_config_id ON webhook_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
