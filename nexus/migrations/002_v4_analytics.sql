-- V4: Analytics + Health Tracking Migration

CREATE TABLE analytics (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  product_id    TEXT,
  run_id        TEXT,
  ai_model      TEXT,
  tokens_used   INTEGER,
  cost          REAL DEFAULT 0,
  latency_ms    INTEGER,
  cached        BOOLEAN DEFAULT false,
  metadata      JSON,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Index for common queries
CREATE INDEX idx_analytics_event_type ON analytics(event_type);
CREATE INDEX idx_analytics_created_at ON analytics(created_at);
CREATE INDEX idx_analytics_ai_model ON analytics(ai_model);
