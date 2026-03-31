-- ============================================================
-- Migration 005: Add missing updated_at columns
-- Migration 004 creates updated_at triggers for all tables,
-- but 9 tables were missing the updated_at column itself.
-- This migration adds the missing columns so triggers work.
-- ============================================================

-- Tables that need updated_at added:
-- domains, platforms, social_channels, workflow_runs,
-- workflow_steps, assets, reviews, ai_models, analytics

ALTER TABLE domains ADD COLUMN updated_at TEXT;

ALTER TABLE platforms ADD COLUMN updated_at TEXT;

ALTER TABLE social_channels ADD COLUMN updated_at TEXT;

ALTER TABLE workflow_runs ADD COLUMN updated_at TEXT;

ALTER TABLE workflow_steps ADD COLUMN updated_at TEXT;

ALTER TABLE assets ADD COLUMN updated_at TEXT;

ALTER TABLE reviews ADD COLUMN updated_at TEXT;

ALTER TABLE ai_models ADD COLUMN updated_at TEXT;

ALTER TABLE analytics ADD COLUMN updated_at TEXT;
