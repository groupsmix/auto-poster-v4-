-- ============================================================
-- NEXUS V4 Migration 010 — ROI Optimizer, Smart Recycler, Multi-Language Printer
-- Phase 2.5: ROI Optimizer / Niche Killer
-- Phase 3: The Multiplier (Smart Recycler + Multi-Language)
-- ============================================================

-- ── ROI Optimizer ──────────────────────────────────────────────

-- Niche cost tracking: AI API costs, time spent per niche/domain/category
CREATE TABLE IF NOT EXISTS niche_costs (
  id              TEXT PRIMARY KEY,
  domain_id       TEXT REFERENCES domains(id) ON DELETE CASCADE,
  category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
  niche           TEXT,
  cost_type       TEXT NOT NULL DEFAULT 'ai_api',
  amount          REAL NOT NULL DEFAULT 0,
  currency        TEXT DEFAULT 'USD',
  description     TEXT,
  product_id      TEXT REFERENCES products(id) ON DELETE SET NULL,
  recorded_at     TEXT DEFAULT (datetime('now'))
);

-- ROI snapshots: periodic ROI calculations per niche
CREATE TABLE IF NOT EXISTS roi_snapshots (
  id              TEXT PRIMARY KEY,
  domain_id       TEXT REFERENCES domains(id) ON DELETE CASCADE,
  category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
  niche           TEXT,
  period          TEXT NOT NULL DEFAULT 'weekly',
  period_start    TEXT NOT NULL,
  period_end      TEXT NOT NULL,
  total_revenue   REAL DEFAULT 0,
  total_cost      REAL DEFAULT 0,
  net_profit      REAL DEFAULT 0,
  roi_multiplier  REAL DEFAULT 0,
  products_count  INTEGER DEFAULT 0,
  orders_count    INTEGER DEFAULT 0,
  recommendation  TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- ROI reports: weekly/monthly summary reports
CREATE TABLE IF NOT EXISTS roi_reports (
  id              TEXT PRIMARY KEY,
  report_type     TEXT NOT NULL DEFAULT 'weekly',
  period_start    TEXT NOT NULL,
  period_end      TEXT NOT NULL,
  winners         JSON,
  losers          JSON,
  recommendations JSON,
  total_revenue   REAL DEFAULT 0,
  total_cost      REAL DEFAULT 0,
  overall_roi     REAL DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- ── Smart Product Recycler ─────────────────────────────────────

-- Recycler jobs: track product variation generation
CREATE TABLE IF NOT EXISTS recycler_jobs (
  id              TEXT PRIMARY KEY,
  source_product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  strategy        TEXT NOT NULL DEFAULT 'angle',
  status          TEXT NOT NULL DEFAULT 'pending',
  variations_requested INTEGER DEFAULT 10,
  variations_created   INTEGER DEFAULT 0,
  variations_approved  INTEGER DEFAULT 0,
  config          JSON,
  analysis        JSON,
  error           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  completed_at    TEXT
);

-- Recycler variations: individual product variations linked to source
CREATE TABLE IF NOT EXISTS recycler_variations (
  id              TEXT PRIMARY KEY,
  job_id          TEXT REFERENCES recycler_jobs(id) ON DELETE CASCADE,
  source_product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  new_product_id  TEXT REFERENCES products(id) ON DELETE SET NULL,
  variation_type  TEXT NOT NULL,
  variation_label TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  metadata        JSON,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- ── Multi-Language Printer ─────────────────────────────────────

-- Localization jobs: track multi-language product creation
CREATE TABLE IF NOT EXISTS localization_jobs (
  id              TEXT PRIMARY KEY,
  source_product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',
  languages_requested JSON NOT NULL,
  languages_completed JSON,
  languages_failed    JSON,
  config          JSON,
  error           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  completed_at    TEXT
);

-- Localized products: individual localized versions
CREATE TABLE IF NOT EXISTS localized_products (
  id              TEXT PRIMARY KEY,
  job_id          TEXT REFERENCES localization_jobs(id) ON DELETE CASCADE,
  source_product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  new_product_id  TEXT REFERENCES products(id) ON DELETE SET NULL,
  target_language TEXT NOT NULL,
  target_locale   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  localization_notes JSON,
  metadata        JSON,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- ── Indexes ────────────────────────────────────────────────────

-- ROI indexes
CREATE INDEX IF NOT EXISTS idx_niche_costs_domain_id ON niche_costs(domain_id);
CREATE INDEX IF NOT EXISTS idx_niche_costs_category_id ON niche_costs(category_id);
CREATE INDEX IF NOT EXISTS idx_niche_costs_niche ON niche_costs(niche);
CREATE INDEX IF NOT EXISTS idx_niche_costs_product_id ON niche_costs(product_id);
CREATE INDEX IF NOT EXISTS idx_roi_snapshots_domain_id ON roi_snapshots(domain_id);
CREATE INDEX IF NOT EXISTS idx_roi_snapshots_niche ON roi_snapshots(niche);
CREATE INDEX IF NOT EXISTS idx_roi_snapshots_period ON roi_snapshots(period);
CREATE INDEX IF NOT EXISTS idx_roi_reports_report_type ON roi_reports(report_type);

-- Recycler indexes
CREATE INDEX IF NOT EXISTS idx_recycler_jobs_source ON recycler_jobs(source_product_id);
CREATE INDEX IF NOT EXISTS idx_recycler_jobs_status ON recycler_jobs(status);
CREATE INDEX IF NOT EXISTS idx_recycler_variations_job ON recycler_variations(job_id);
CREATE INDEX IF NOT EXISTS idx_recycler_variations_source ON recycler_variations(source_product_id);
CREATE INDEX IF NOT EXISTS idx_recycler_variations_status ON recycler_variations(status);

-- Localization indexes
CREATE INDEX IF NOT EXISTS idx_localization_jobs_source ON localization_jobs(source_product_id);
CREATE INDEX IF NOT EXISTS idx_localization_jobs_status ON localization_jobs(status);
CREATE INDEX IF NOT EXISTS idx_localized_products_job ON localized_products(job_id);
CREATE INDEX IF NOT EXISTS idx_localized_products_source ON localized_products(source_product_id);
CREATE INDEX IF NOT EXISTS idx_localized_products_lang ON localized_products(target_language);
CREATE INDEX IF NOT EXISTS idx_localized_products_status ON localized_products(status);
