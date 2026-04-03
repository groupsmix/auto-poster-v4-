-- ============================================================
-- NEXUS V5 — "Ship or Die" Refactor Migration
-- Addresses: Cold Start, CF Workflows Lock-in, Niche Contamination
-- ============================================================

-- ============================================================
-- 1. NICHE ISOLATION — Add niche_id to EVERY table
-- ============================================================

-- Create niches table first
CREATE TABLE IF NOT EXISTS niches (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  settings    JSON DEFAULT '{}',
  is_active   BOOLEAN DEFAULT true,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Add niche_id to all existing tables
ALTER TABLE domains ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE workflow_runs ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE workflow_steps ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE assets ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE platform_variants ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE social_variants ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;
ALTER TABLE revision_history ADD COLUMN niche_id TEXT REFERENCES niches(id) ON DELETE CASCADE;

-- ============================================================
-- 2. D1 STATE MACHINE — Replace CF Workflows
-- ============================================================

CREATE TABLE IF NOT EXISTS job_queue (
  id              TEXT PRIMARY KEY,
  niche_id        TEXT NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  
  -- Job identification
  job_type        TEXT NOT NULL, -- 'product_generation', 'publish', 'recycle', 'conflict_check'
  entity_type     TEXT NOT NULL, -- 'product', 'campaign', 'batch'
  entity_id       TEXT NOT NULL,
  
  -- State machine
  status          TEXT NOT NULL DEFAULT 'pending', -- pending, running, paused, completed, failed, cancelled
  current_step    TEXT DEFAULT NULL, -- current step name
  total_steps     INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  
  -- Step tracking (JSON array of steps with their state)
  steps_json      JSON DEFAULT '[]',
  
  -- Input/output
  input_json      JSON DEFAULT '{}',
  output_json     JSON DEFAULT '{}',
  
  -- Error handling
  error           TEXT,
  retry_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  
  -- Scheduling
  scheduled_at    TEXT, -- when to run (NULL = ASAP)
  started_at      TEXT,
  completed_at    TEXT,
  
  -- Worker assignment
  worker_id       TEXT, -- which worker picked this up
  locked_at       TEXT, -- when worker claimed it
  lock_expires_at TEXT, -- when lock expires (heartbeat timeout)
  
  -- Metadata
  priority        INTEGER DEFAULT 5, -- 1-10, lower = higher priority
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Indexes for job queue performance
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_niche_status ON job_queue(niche_id, status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON job_queue(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON job_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_worker_lock ON job_queue(worker_id, lock_expires_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_entity ON job_queue(entity_type, entity_id);

-- ============================================================
-- 3. ATTRIBUTION TRACKING — Revenue Blindness Fix
-- ============================================================

CREATE TABLE IF NOT EXISTS attribution (
  id              TEXT PRIMARY KEY,
  niche_id        TEXT NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  
  -- UTM parameters (auto-generated)
  utm_source      TEXT, -- 'nexus'
  utm_medium      TEXT, -- 'organic', 'social', 'email'
  utm_campaign    TEXT, -- niche slug
  utm_content     TEXT, -- product_id
  utm_term        TEXT, -- platform
  
  -- Link tracking
  short_code      TEXT UNIQUE, -- e.g., 'nx7a2b' for short URLs
  full_url        TEXT,
  
  -- Revenue tracking
  product_id      TEXT REFERENCES products(id),
  platform_id     TEXT REFERENCES platforms(id),
  
  -- Stripe integration
  stripe_payment_id TEXT,
  revenue_usd     REAL DEFAULT 0,
  
  -- Analytics
  clicks          INTEGER DEFAULT 0,
  conversions     INTEGER DEFAULT 0,
  first_click_at  TEXT,
  last_click_at   TEXT,
  
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attribution_niche ON attribution(niche_id);
CREATE INDEX IF NOT EXISTS idx_attribution_product ON attribution(product_id);
CREATE INDEX IF NOT EXISTS idx_attribution_short_code ON attribution(short_code);
CREATE INDEX IF NOT EXISTS idx_attribution_stripe ON attribution(stripe_payment_id);

-- ============================================================
-- 4. CONFLICT DETECTION — Pre-publish safety
-- ============================================================

CREATE TABLE IF NOT EXISTS content_statements (
  id              TEXT PRIMARY KEY,
  niche_id        TEXT NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  
  -- The statement
  product_id      TEXT REFERENCES products(id),
  statement_hash  TEXT NOT NULL, -- SHA256 of normalized statement
  statement_text  TEXT NOT NULL,
  
  -- Classification
  category        TEXT, -- 'pricing', 'feature', 'opinion', 'claim'
  sentiment       TEXT, -- 'positive', 'negative', 'neutral'
  
  -- Temporal tracking
  published_at    TEXT,
  expires_at      TEXT, -- when this statement becomes stale
  
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_statements_niche_hash ON content_statements(niche_id, statement_hash);
CREATE INDEX IF NOT EXISTS idx_statements_expires ON content_statements(expires_at);

-- ============================================================
-- 5. CONTENT RECYCLER — Resurrection tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS recycled_content (
  id              TEXT PRIMARY KEY,
  niche_id        TEXT NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  
  original_product_id TEXT REFERENCES products(id),
  recycled_product_id TEXT REFERENCES products(id),
  
  -- Performance metrics at time of recycle decision
  original_views  INTEGER,
  original_revenue REAL,
  performance_score REAL, -- calculated score that triggered recycle
  
  -- Recycle settings
  wrapper_text    TEXT, -- e.g., "Updated for 2026"
  new_angle       TEXT, -- what angle to take on resurface
  
  scheduled_at    TEXT,
  published_at    TEXT,
  
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recycled_niche ON recycled_content(niche_id);
CREATE INDEX IF NOT EXISTS idx_recycled_scheduled ON recycled_content(scheduled_at);

-- ============================================================
-- 6. EMERGENCY KILL SWITCH — Audit log
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_events (
  id              TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL, -- 'nuke', 'pause', 'resume', 'token_revoke'
  triggered_by    TEXT, -- API key that triggered it
  reason          TEXT,
  
  -- Snapshot of what was affected
  affected_niches JSON,
  affected_jobs   INTEGER,
  
  -- Recovery
  backup_exported BOOLEAN DEFAULT false,
  recovered_at    TEXT,
  
  created_at      TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- 7. RLS VIEWS — Enforce niche isolation at query level
-- ============================================================

-- Helper function to validate niche access (enforced in app layer)
CREATE TABLE IF NOT EXISTS rls_sessions (
  api_key         TEXT PRIMARY KEY,
  allowed_niches  JSON NOT NULL, -- array of niche_ids this key can access
  ip_whitelist    JSON, -- array of allowed IPs (NULL = any)
  created_at      TEXT DEFAULT (datetime('now')),
  expires_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_rls_api_key ON rls_sessions(api_key);

-- ============================================================
-- 8. INDEXES FOR SHARDING (by year)
-- ============================================================

-- These indexes support the year-based sharding strategy
CREATE INDEX IF NOT EXISTS idx_products_created_year ON products(strftime('%Y', created_at));
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_year ON workflow_runs(strftime('%Y', started_at));
CREATE INDEX IF NOT EXISTS idx_job_queue_created_year ON job_queue(strftime('%Y', created_at));

-- ============================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE TRIGGER IF NOT EXISTS job_queue_updated_at 
AFTER UPDATE ON job_queue
BEGIN
  UPDATE job_queue SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================
-- 10. DEFAULT NICHE (for migration compatibility)
-- ============================================================

INSERT OR IGNORE INTO niches (id, name, slug, description) 
VALUES ('default', 'Default Niche', 'default', 'Migration default niche - reassign items to proper niches');

-- Update existing records to use default niche where NULL
UPDATE domains SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE categories SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE products SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE workflow_runs SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE workflow_steps SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE assets SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE platform_variants SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE social_variants SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE reviews SET niche_id = 'default' WHERE niche_id IS NULL;
UPDATE revision_history SET niche_id = 'default' WHERE niche_id IS NULL;
