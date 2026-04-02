-- Migration 020: Tables for remaining 10 features
-- Social Media, Niche Discovery, Notifications, POD, etc.

-- Social Media Credentials (OAuth tokens for social platforms)
CREATE TABLE IF NOT EXISTS social_credentials (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  account_id TEXT,
  account_name TEXT,
  scopes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Social Post Logs (history of posts made to social platforms)
CREATE TABLE IF NOT EXISTS social_post_logs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  post_id TEXT,
  post_url TEXT,
  error TEXT,
  posted_at TEXT DEFAULT (datetime('now'))
);

-- Niche Discoveries (Daily Scout results)
CREATE TABLE IF NOT EXISTS niche_discoveries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  trend_score REAL DEFAULT 0,
  search_volume INTEGER,
  competition_level TEXT,
  suggested_domains TEXT,
  suggested_categories TEXT,
  keywords TEXT,
  reasoning TEXT,
  status TEXT DEFAULT 'new',
  discovered_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Notification Configs (email/SMS notification settings)
CREATE TABLE IF NOT EXISTS notification_configs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  recipient TEXT NOT NULL,
  events TEXT DEFAULT '[]',
  provider TEXT,
  api_key_ref TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Notification Logs (history of sent notifications)
CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  config_id TEXT,
  event_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  sent_at TEXT DEFAULT (datetime('now'))
);

-- POD Products (Print-on-Demand product tracking)
CREATE TABLE IF NOT EXISTS pod_products (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  product_type TEXT DEFAULT 'general',
  variants TEXT DEFAULT '[]',
  mockup_urls TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_social_credentials_platform ON social_credentials(platform);
CREATE INDEX IF NOT EXISTS idx_social_post_logs_platform ON social_post_logs(platform);
CREATE INDEX IF NOT EXISTS idx_niche_discoveries_status ON niche_discoveries(status);
CREATE INDEX IF NOT EXISTS idx_niche_discoveries_source ON niche_discoveries(source);
CREATE INDEX IF NOT EXISTS idx_notification_configs_type ON notification_configs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_config ON notification_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_pod_products_provider ON pod_products(provider);
CREATE INDEX IF NOT EXISTS idx_pod_products_status ON pod_products(status);
