-- NEXUS V4 Initial Schema
-- Cloudflare D1 SQL Migration

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

-- Generated assets
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

-- Revision history
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

-- Prompt templates
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

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('social_posting_mode', 'manual'),
  ('default_language', 'en'),
  ('ceo_review_required', 'true'),
  ('auto_publish_after_approval', 'false'),
  ('batch_max_products', '10'),
  ('cache_enabled', 'true'),
  ('ai_gateway_enabled', 'true');
