-- Migration 004: Add updated_at triggers
-- Ensures updated_at is automatically set on every UPDATE,
-- removing the need for application code to remember it.

CREATE TRIGGER IF NOT EXISTS trg_domains_updated_at
AFTER UPDATE ON domains
FOR EACH ROW
BEGIN
  UPDATE domains SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_categories_updated_at
AFTER UPDATE ON categories
FOR EACH ROW
BEGIN
  UPDATE categories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_platforms_updated_at
AFTER UPDATE ON platforms
FOR EACH ROW
BEGIN
  UPDATE platforms SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_social_channels_updated_at
AFTER UPDATE ON social_channels
FOR EACH ROW
BEGIN
  UPDATE social_channels SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_products_updated_at
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_workflow_runs_updated_at
AFTER UPDATE ON workflow_runs
FOR EACH ROW
BEGIN
  UPDATE workflow_runs SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_workflow_steps_updated_at
AFTER UPDATE ON workflow_steps
FOR EACH ROW
BEGIN
  UPDATE workflow_steps SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_assets_updated_at
AFTER UPDATE ON assets
FOR EACH ROW
BEGIN
  UPDATE assets SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_reviews_updated_at
AFTER UPDATE ON reviews
FOR EACH ROW
BEGIN
  UPDATE reviews SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_prompt_templates_updated_at
AFTER UPDATE ON prompt_templates
FOR EACH ROW
BEGIN
  UPDATE prompt_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_ai_models_updated_at
AFTER UPDATE ON ai_models
FOR EACH ROW
BEGIN
  UPDATE ai_models SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_analytics_updated_at
AFTER UPDATE ON analytics
FOR EACH ROW
BEGIN
  UPDATE analytics SET updated_at = datetime('now') WHERE id = NEW.id;
END;
