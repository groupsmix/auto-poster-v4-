-- ============================================================
-- NEXUS V4 Migration 007 — Scheduler, Campaigns & Auto-Approve
-- Phase 1: The Auto-Pilot
-- ============================================================

-- Schedules: "Create N products per day in Domain X / Category Y"
CREATE TABLE IF NOT EXISTS schedules (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  domain_id       TEXT REFERENCES domains(id) ON DELETE CASCADE,
  category_id     TEXT REFERENCES categories(id) ON DELETE CASCADE,
  niche_keywords  JSON,
  products_per_run INTEGER DEFAULT 1,
  interval_hours  INTEGER DEFAULT 24,
  platforms       JSON,
  social_channels JSON,
  language        TEXT DEFAULT 'en',
  auto_approve_threshold INTEGER DEFAULT 9,
  auto_revise_min_score  INTEGER DEFAULT 7,
  max_auto_revisions     INTEGER DEFAULT 2,
  is_active       BOOLEAN DEFAULT true,
  last_run_at     TEXT,
  next_run_at     TEXT,
  total_products_created INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Schedule run log
CREATE TABLE IF NOT EXISTS schedule_runs (
  id              TEXT PRIMARY KEY,
  schedule_id     TEXT REFERENCES schedules(id) ON DELETE CASCADE,
  status          TEXT DEFAULT 'running',
  products_created INTEGER DEFAULT 0,
  products_approved INTEGER DEFAULT 0,
  products_failed  INTEGER DEFAULT 0,
  error           TEXT,
  started_at      TEXT DEFAULT (datetime('now')),
  completed_at    TEXT
);

-- Campaigns: "I want 200 products in Home Decor by end of month"
CREATE TABLE IF NOT EXISTS campaigns (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  domain_id       TEXT REFERENCES domains(id) ON DELETE CASCADE,
  category_id     TEXT REFERENCES categories(id),
  target_count    INTEGER NOT NULL,
  daily_target    INTEGER DEFAULT 0,
  deadline        TEXT,
  niche_keywords  JSON,
  platforms       JSON,
  social_channels JSON,
  language        TEXT DEFAULT 'en',
  auto_approve_threshold INTEGER DEFAULT 9,
  status          TEXT DEFAULT 'active',
  products_created INTEGER DEFAULT 0,
  products_approved INTEGER DEFAULT 0,
  products_published INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Indexes for scheduler
CREATE INDEX IF NOT EXISTS idx_schedules_domain_id ON schedules(domain_id);
CREATE INDEX IF NOT EXISTS idx_schedules_category_id ON schedules(category_id);
CREATE INDEX IF NOT EXISTS idx_schedules_is_active ON schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run_at ON schedules(next_run_at);

CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule_id ON schedule_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_status ON schedule_runs(status);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_domain_id ON campaigns(domain_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_category_id ON campaigns(category_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
