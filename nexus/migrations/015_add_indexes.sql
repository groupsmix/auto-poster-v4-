-- Migration 015: Add missing database indexes for query performance
-- These indexes cover the most common lookup patterns across the app.

-- Products: frequently filtered by status, domain, and category
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_domain ON products(domain_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Workflow runs/steps: always queried by parent ID
CREATE INDEX IF NOT EXISTS idx_workflow_runs_product ON workflow_runs(product_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON workflow_steps(run_id);

-- Revenue records: queried by product and connection
CREATE INDEX IF NOT EXISTS idx_revenue_records_product ON revenue_records(product_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_connection ON revenue_records(connection_id);

-- Schedule runs: queried by parent schedule
CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule ON schedule_runs(schedule_id);

-- Analytics: queried by event type and date range
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);

-- AI health daily: queried by model and date
CREATE INDEX IF NOT EXISTS idx_ai_health_daily_model_date ON ai_health_daily(model_id, date);

-- Campaigns: queried by status and deadline
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Chatbot messages: queried by conversation
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation ON chatbot_messages(conversation_id);
