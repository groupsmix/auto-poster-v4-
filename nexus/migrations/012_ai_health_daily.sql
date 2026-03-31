-- ============================================================
-- Migration 012: AI Health Daily Snapshots
-- Stores daily health score snapshots per model for 7-day
-- rolling window analysis and smart reorder suggestions.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_health_daily (
  id          TEXT PRIMARY KEY,
  model_id    TEXT NOT NULL,
  model_name  TEXT NOT NULL,
  date        TEXT NOT NULL,
  total_calls     INTEGER NOT NULL DEFAULT 0,
  total_failures  INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms  REAL NOT NULL DEFAULT 0,
  health_score    REAL NOT NULL DEFAULT 100,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One snapshot per model per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_health_daily_model_date
  ON ai_health_daily(model_id, date);

-- Fast lookups for 7-day window queries
CREATE INDEX IF NOT EXISTS idx_ai_health_daily_date
  ON ai_health_daily(date);
