-- ============================================================
-- NEXUS V4 Initial Schema
-- Cloudflare D1 (SQLite dialect)
-- ============================================================

-- Core domain/category structure
CREATE TABLE domains (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  description TEXT,
  icon        TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  domain_id   TEXT REFERENCES domains(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT,
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true
);

-- Platform and social channel configs
CREATE TABLE platforms (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  title_max_chars INTEGER,
  tag_count       INTEGER,
  tag_max_chars   INTEGER,
  audience        TEXT,
  tone            TEXT,
  seo_style       TEXT,
  description_style TEXT,
  cta_style       TEXT,
  rules_json      JSON,
  is_active       BOOLEAN DEFAULT true
);

CREATE TABLE social_channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  caption_max_chars INTEGER,
  hashtag_count   INTEGER,
  tone            TEXT,
  format          TEXT,
  content_types   JSON,
  is_active       BOOLEAN DEFAULT true
);

-- Products and their workflow runs
CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  domain_id     TEXT REFERENCES domains(id),
  category_id   TEXT REFERENCES categories(id),
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

CREATE TABLE workflow_runs (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  batch_id      TEXT,
  status        TEXT DEFAULT 'queued',
  started_at    TEXT,
  completed_at  TEXT,
  current_step  TEXT,
  total_steps   INTEGER,
  total_tokens  INTEGER DEFAULT 0,
  total_cost    REAL DEFAULT 0,
  cache_hits    INTEGER DEFAULT 0,
  error         TEXT
);

CREATE TABLE workflow_steps (
  id            TEXT PRIMARY KEY,
  run_id        TEXT REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_name     TEXT NOT NULL,
  step_order    INTEGER,
  status        TEXT DEFAULT 'waiting',
  ai_used       TEXT,
  ai_tried      JSON,
  input         JSON,
  output        JSON,
  tokens_used   INTEGER,
  cost          REAL DEFAULT 0,
  cached        BOOLEAN DEFAULT false,
  latency_ms    INTEGER,
  started_at    TEXT,
  completed_at  TEXT
);

-- Generated assets (files stored in R2)
CREATE TABLE assets (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  asset_type    TEXT,
  r2_key        TEXT,
  cf_image_id   TEXT,
  url           TEXT,
  metadata      JSON,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Platform-specific listings per product
CREATE TABLE platform_variants (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  platform_id   TEXT REFERENCES platforms(id),
  title         TEXT,
  description   TEXT,
  tags          JSON,
  price         REAL,
  metadata      JSON,
  status        TEXT DEFAULT 'draft',
  published_at  TEXT
);

-- Social media content per product per channel
CREATE TABLE social_variants (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  channel_id    TEXT REFERENCES social_channels(id),
  content       JSON,
  status        TEXT DEFAULT 'draft',
  scheduled_at  TEXT,
  published_at  TEXT
);

-- CEO review history
CREATE TABLE reviews (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  run_id        TEXT REFERENCES workflow_runs(id),
  version       INTEGER DEFAULT 1,
  ai_score      REAL,
  ai_model      TEXT,
  decision      TEXT,
  feedback      TEXT,
  reviewed_at   TEXT DEFAULT (datetime('now'))
);

-- Revision history (full audit trail)
CREATE TABLE revision_history (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE CASCADE,
  version       INTEGER,
  output        JSON,
  feedback      TEXT,
  ai_score      REAL,
  ai_model      TEXT,
  reviewed_at   TEXT,
  decision      TEXT
);

-- Prompt templates (editable from dashboard Prompt Manager)
CREATE TABLE prompt_templates (
  id            TEXT PRIMARY KEY,
  layer         TEXT,
  target_id     TEXT,
  name          TEXT,
  prompt        TEXT,
  version       INTEGER DEFAULT 1,
  is_active     BOOLEAN DEFAULT true,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- AI model registry and failover state
CREATE TABLE ai_models (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  provider            TEXT,
  task_type           TEXT,
  rank                INTEGER,
  api_key_secret_name TEXT,
  is_workers_ai       BOOLEAN DEFAULT false,
  status              TEXT DEFAULT 'active',
  rate_limit_reset_at TEXT,
  daily_limit_reset_at TEXT,
  is_free_tier        BOOLEAN DEFAULT true,
  health_score        INTEGER DEFAULT 100,
  total_calls         INTEGER DEFAULT 0,
  total_failures      INTEGER DEFAULT 0,
  avg_latency_ms      INTEGER DEFAULT 0,
  notes               TEXT
);

-- Settings
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================

-- Products
CREATE INDEX idx_products_domain_id ON products(domain_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_batch_id ON products(batch_id);
CREATE INDEX idx_products_status ON products(status);

-- Workflow runs
CREATE INDEX idx_workflow_runs_product_id ON workflow_runs(product_id);
CREATE INDEX idx_workflow_runs_batch_id ON workflow_runs(batch_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);

-- Workflow steps
CREATE INDEX idx_workflow_steps_run_id ON workflow_steps(run_id);

-- Assets
CREATE INDEX idx_assets_product_id ON assets(product_id);

-- Platform variants
CREATE INDEX idx_platform_variants_product_id ON platform_variants(product_id);
CREATE INDEX idx_platform_variants_platform_id ON platform_variants(platform_id);

-- Social variants
CREATE INDEX idx_social_variants_product_id ON social_variants(product_id);
CREATE INDEX idx_social_variants_channel_id ON social_variants(channel_id);

-- Reviews
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_run_id ON reviews(run_id);

-- Revision history
CREATE INDEX idx_revision_history_product_id ON revision_history(product_id);

-- Prompt templates
CREATE INDEX idx_prompt_templates_layer ON prompt_templates(layer);
CREATE INDEX idx_prompt_templates_target_id ON prompt_templates(target_id);

-- AI models
CREATE INDEX idx_ai_models_task_type ON ai_models(task_type);
CREATE INDEX idx_ai_models_status ON ai_models(status);

-- Categories
CREATE INDEX idx_categories_domain_id ON categories(domain_id);
