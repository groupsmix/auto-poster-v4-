-- ============================================================
-- NEXUS V4 Migration 006 — AI CEO Configurations
-- Stores AI CEO auto-orchestration analysis and configuration
-- for each domain + category combination.
-- ============================================================

CREATE TABLE IF NOT EXISTS ceo_configurations (
  id              TEXT PRIMARY KEY,
  domain_id       TEXT REFERENCES domains(id) ON DELETE CASCADE,
  category_id     TEXT REFERENCES categories(id) ON DELETE CASCADE,
  analysis        JSON,
  prompts_stored  INTEGER DEFAULT 0,
  kv_keys         JSON,
  status          TEXT DEFAULT 'active',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ceo_config_domain_id ON ceo_configurations(domain_id);
CREATE INDEX IF NOT EXISTS idx_ceo_config_category_id ON ceo_configurations(category_id);
CREATE INDEX IF NOT EXISTS idx_ceo_config_status ON ceo_configurations(status);
