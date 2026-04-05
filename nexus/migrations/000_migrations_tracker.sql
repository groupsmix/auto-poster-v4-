-- ============================================================
-- Migration 000: Migration Tracking Table
-- Tracks which migrations have been applied to prevent re-runs.
-- This migration is always safe to re-run (uses IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);
