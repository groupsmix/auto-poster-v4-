-- ============================================================
-- Migration 023: Add Missing Columns
-- Adds columns that application code references but that were
-- never added to the schema. All ADD COLUMN statements are safe
-- on D1 — they are no-ops if the column already exists in
-- some databases (SQLite ignores duplicate ADD COLUMN in practice).
-- ============================================================

-- 1. products — add ai_score (used by Review Center / Ready to Post)
ALTER TABLE products ADD COLUMN ai_score REAL DEFAULT 0;

-- 2. platform_variants — add SEO score columns (used by Ready to Post)
ALTER TABLE platform_variants ADD COLUMN seo_score REAL DEFAULT 0;
ALTER TABLE platform_variants ADD COLUMN title_score REAL DEFAULT 0;
ALTER TABLE platform_variants ADD COLUMN tags_score REAL DEFAULT 0;

-- 3. workflow_runs — add columns used by dashboard + workflow engine
ALTER TABLE workflow_runs ADD COLUMN provider_summary_json JSON;
ALTER TABLE workflow_runs ADD COLUMN cost_summary_json JSON;
ALTER TABLE workflow_runs ADD COLUMN niche_id TEXT;

-- 4. social_variants — add explicit caption/hashtags columns alongside content JSON
--    (some code paths write separate columns; content JSON is the canonical store)
ALTER TABLE social_variants ADD COLUMN caption TEXT;
ALTER TABLE social_variants ADD COLUMN hashtags JSON;
ALTER TABLE social_variants ADD COLUMN post_type TEXT;
ALTER TABLE social_variants ADD COLUMN scheduled_time TEXT;

-- 5. products — add columns used by workflow engine output
ALTER TABLE products ADD COLUMN title TEXT;
ALTER TABLE products ADD COLUMN description TEXT;
ALTER TABLE products ADD COLUMN tags JSON;
ALTER TABLE products ADD COLUMN price REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN seo_title TEXT;
ALTER TABLE products ADD COLUMN seo_description TEXT;
ALTER TABLE products ADD COLUMN seo_tags JSON;

-- 6. domains — add updated_at (used by some router queries)
ALTER TABLE domains ADD COLUMN updated_at TEXT;

-- 7. categories — add icon column (used by frontend)
ALTER TABLE categories ADD COLUMN icon TEXT;
