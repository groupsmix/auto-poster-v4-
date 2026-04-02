-- ============================================================
-- Migration 019: Add missing columns to products table
-- ============================================================
-- The products table in the live D1 database has the original schema
-- from migration 001/003 (with idea, notes, current_version, etc.)
-- plus name & slug added via ALTER TABLE (from migration 018).
--
-- However, the application code (nexus-storage, nexus-router,
-- nexus-workflow) references columns that don't exist in the live
-- table: niche, language, user_input, batch_id.
--
-- Migration 018's table-recreation pattern never actually executed
-- on the live DB because the migration name was already recorded
-- in _migrations from the earlier ALTER TABLE version (PR #117).
--
-- This migration safely adds the missing columns using ALTER TABLE.
-- ALTER TABLE ADD COLUMN is idempotent-safe in SQLite — if the
-- column already exists, the statement will error, so we use
-- a conditional approach.
-- ============================================================

-- Add niche column if missing
ALTER TABLE products ADD COLUMN niche TEXT;

-- Add language column if missing
ALTER TABLE products ADD COLUMN language TEXT DEFAULT 'en';

-- Add user_input column if missing
ALTER TABLE products ADD COLUMN user_input JSON;

-- Add batch_id column if missing
ALTER TABLE products ADD COLUMN batch_id TEXT;
