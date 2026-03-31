-- ============================================================
-- Migration 010: AI Project Builder tables
-- Multi-phase AI code generation pipeline
-- ============================================================

-- Main project build entity
CREATE TABLE IF NOT EXISTS project_builds (
  id TEXT PRIMARY KEY,
  idea TEXT NOT NULL,
  tech_stack TEXT,
  features TEXT,           -- JSON array
  target_user TEXT,
  design_style TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  current_phase TEXT NOT NULL DEFAULT 'plan',
  current_cycle INTEGER NOT NULL DEFAULT 1,
  max_cycles INTEGER NOT NULL DEFAULT 5,
  quality_score REAL,
  spec TEXT,               -- JSON: ProjectSpec
  blueprint TEXT,          -- JSON: ArchitectureBlueprint
  validation_report TEXT,  -- JSON: ValidationReport
  total_files INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

-- Steps within each build pipeline run
CREATE TABLE IF NOT EXISTS project_build_steps (
  id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL REFERENCES project_builds(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,        -- plan | build | validate
  agent_role TEXT NOT NULL,   -- ceo, architect, designer, etc.
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  cycle INTEGER NOT NULL DEFAULT 1,
  output TEXT,                -- JSON: step output
  ai_model TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  cached INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  error TEXT,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_build_steps_build_id ON project_build_steps(build_id);
CREATE INDEX IF NOT EXISTS idx_project_build_steps_phase ON project_build_steps(phase);

-- Generated files for each project build
CREATE TABLE IF NOT EXISTS project_build_files (
  id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL REFERENCES project_builds(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  cycle INTEGER NOT NULL DEFAULT 1,
  language TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_build_files_build_id ON project_build_files(build_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_build_files_path ON project_build_files(build_id, file_path, cycle);

-- Contracts generated during the plan phase
CREATE TABLE IF NOT EXISTS project_contracts (
  id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL REFERENCES project_builds(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL, -- database-schema | api-contracts | component-contracts | page-contracts | design-tokens
  content TEXT NOT NULL,       -- JSON contract content
  cycle INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_contracts_build_id ON project_contracts(build_id);
