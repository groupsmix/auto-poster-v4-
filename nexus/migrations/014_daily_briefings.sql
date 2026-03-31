-- ============================================================
-- NEXUS V4 Migration 014 — Daily Intelligence Briefings
-- AI-powered daily business intelligence at your configured time
-- ============================================================

-- Daily briefings: AI-generated business intelligence reports
CREATE TABLE IF NOT EXISTS daily_briefings (
  id              TEXT PRIMARY KEY,
  briefing_date   TEXT NOT NULL,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  sections        JSON NOT NULL,
  domains_analyzed JSON,
  focus_keywords  JSON,
  ai_model_used   TEXT,
  tokens_used     INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'completed',
  generated_at    TEXT DEFAULT (datetime('now')),
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Briefing settings: user preferences for automated briefings
CREATE TABLE IF NOT EXISTS briefing_settings (
  id              TEXT PRIMARY KEY DEFAULT 'default',
  user_timezone   TEXT DEFAULT 'UTC',
  briefing_hour   INTEGER DEFAULT 8,
  briefing_enabled INTEGER DEFAULT 0,
  focus_domains   JSON,
  focus_keywords  JSON,
  briefing_types  JSON DEFAULT '["trends","predictions","opportunities","action_items"]',
  last_generated_at TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Insert default briefing settings row
INSERT OR IGNORE INTO briefing_settings (id) VALUES ('default');

-- Indexes for briefings
CREATE INDEX IF NOT EXISTS idx_daily_briefings_date ON daily_briefings(briefing_date);
CREATE INDEX IF NOT EXISTS idx_daily_briefings_status ON daily_briefings(status);
CREATE INDEX IF NOT EXISTS idx_daily_briefings_generated_at ON daily_briefings(generated_at);
