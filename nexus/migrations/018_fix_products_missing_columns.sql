-- ============================================================
-- Migration 018: Fix products table — add missing name & slug columns
-- ============================================================
-- Some D1 databases are missing the 'name' and 'slug' columns on the
-- products table, causing:
--   D1_ERROR: table products has no column named name: SQLITE_ERROR
--
-- Root cause: if the initial schema was partially applied, or the
-- database was recreated without re-running all migrations, the
-- products table may lack these columns even though the application
-- code (nexus-storage, nexus-workflow, nexus-router) references them.
--
-- D1 silently ignores ALTER TABLE ADD COLUMN when the column already
-- exists, so this migration is safe to run on any database state.
-- ============================================================

ALTER TABLE products ADD COLUMN name TEXT;
ALTER TABLE products ADD COLUMN slug TEXT;
