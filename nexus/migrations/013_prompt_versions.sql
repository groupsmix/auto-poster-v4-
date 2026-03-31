-- ============================================================
-- Migration 013: Prompt Version History
-- Stores previous prompt text before updates so users can
-- view history and revert to earlier versions.
-- ============================================================

CREATE TABLE IF NOT EXISTS prompt_versions (
  id            TEXT PRIMARY KEY,
  prompt_id     TEXT NOT NULL,
  version       INTEGER NOT NULL,
  prompt        TEXT NOT NULL,
  name          TEXT,
  layer         TEXT,
  changed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (prompt_id) REFERENCES prompt_templates(id) ON DELETE CASCADE
);

-- Fast lookup: all versions of a given prompt, newest first
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id
  ON prompt_versions(prompt_id, version DESC);
