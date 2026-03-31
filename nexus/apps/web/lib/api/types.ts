// ============================================================
// Frontend-specific types (not in @nexus/shared)
// ============================================================

import type { ProductStatus, Platform, SocialChannel, Campaign } from "@nexus/shared";

// --- Review ---

export interface ReviewItem {
  id: string;
  product_id: string;
  product_name: string;
  domain_name?: string;
  category_name?: string;
  ai_score: number;
  ai_model: string;
  decision?: string;
  feedback?: string;
  version: number;
  reviewed_at: string;
  status: ProductStatus;
}

export interface ReviewDetail {
  id: string;
  product_name: string;
  description: string;
  ai_score: number;
  ai_model: string;
  ai_health: number;
  ai_status: string;
  cache_hits: number;
  total_cost: number;
  tokens_used: number;
  platform_variants: PlatformVariantData[];
  social_variants: SocialVariantData[];
  images: string[];
}

export interface PlatformVariantData {
  platform: string;
  title: string;
  description: string;
  tags: string[];
  price: number;
  scores: { seo: number; title: number; tags: number };
}

export interface SocialVariantData {
  channel: string;
  caption: string;
  hashtags: string[];
  post_type: string;
  scheduled_time?: string;
}

export interface PublishableProduct {
  id: string;
  product_id: string;
  product_name: string;
  domain_name?: string;
  category_name?: string;
  ai_score: number;
  status: ProductStatus;
  platform_variants: PlatformVariantData[];
  social_variants: SocialVariantData[];
  posting_mode: "auto" | "manual";
}

// --- Platform / Social Channel (full) ---

export interface PlatformFull extends Platform {
  title_max_chars: number | undefined;
  tag_count: number | undefined;
  tag_max_chars: number | undefined;
  audience: string;
  tone: string;
  seo_style: string;
  description_style: string;
  cta_style: string;
  forbidden_words: string;
}

export interface SocialChannelFull extends SocialChannel {
  caption_max_chars: number | undefined;
  hashtag_count: number | undefined;
  tone: string;
  format: string;
  content_types: string[];
}

// --- Analytics (V4) ---

export interface AnalyticsSummary {
  total_products_all_time: number;
  total_products_this_month: number;
  total_ai_calls_all_time: number;
  total_ai_calls_this_month: number;
  cache_hit_rate: number;
  total_cost: number;
  avg_workflow_time_ms: number;
  cost_savings: number;
}

export interface AIUsageOverTime {
  date: string;
  provider: string;
  tokens: number;
}

export interface CostBreakdownItem {
  provider: string;
  cost: number;
}

export interface StepCostItem {
  step_name: string;
  total_runs: number;
  total_cost: number;
  avg_cost: number;
  total_tokens: number;
  avg_latency_ms: number;
}

export interface CacheHitTrendItem {
  date: string;
  hit_rate: number;
}

export interface DomainBreakdownItem {
  domain: string;
  count: number;
}

export interface CategoryBreakdownItem {
  category: string;
  count: number;
}

export interface AILeaderboardEntry {
  id: string;
  name: string;
  provider: string;
  health_score: number;
  avg_latency_ms: number;
  total_calls: number;
  total_failures: number;
}

/** Combined analytics dashboard response (5.4) */
export interface AnalyticsDashboard {
  summary: AnalyticsSummary;
  aiUsage: AIUsageOverTime[];
  costBreakdown: CostBreakdownItem[];
  cacheHitTrend: CacheHitTrendItem[];
  productsByDomain: DomainBreakdownItem[];
  productsByCategory: CategoryBreakdownItem[];
  leaderboard: AILeaderboardEntry[];
}

// --- Query params ---

/** Query parameters for product listing */
export interface ProductListParams {
  status?: string;
  domain_id?: string;
  category_id?: string;
  platform?: string;
  batch_id?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

/** Query parameters for workflow run listing */
export interface RunListParams {
  status?: string;
  limit?: string;
  offset?: string;
}

// --- History ---

export interface RevisionEntry {
  id: string;
  product_id: string;
  version: number;
  feedback?: string;
  ai_score: number;
  ai_model: string;
  reviewed_at: string;
  decision: string;
}

// --- Settings ---

/** Settings stored as key-value pairs in D1 */
export type SettingsMap = Record<
  | "social_posting_mode"
  | "default_language"
  | "ceo_review_required"
  | "auto_publish_after_approval"
  | "batch_max_products"
  | "cache_enabled"
  | "ai_gateway_enabled",
  string
>;

// --- API Keys ---

export interface APIKeyEntry {
  key_name: string;
  display_name: string;
  status: "active" | "not_set";
}

// --- AI CEO ---

export interface CEONicheAnalysis {
  market_overview: string;
  target_audience: string;
  buyer_psychology: string;
  price_positioning: string;
  competitive_landscape: string;
  demand_signals: string[];
  key_differentiators: string[];
}

export interface CEOWorkflowConfig {
  recommended_platforms: string[];
  recommended_social_channels: string[];
  content_tone: string;
  content_style: string;
  pricing_strategy: string;
  seo_focus_keywords: string[];
  quality_threshold: number;
}

export interface CEOAnalysis {
  niche_analysis: CEONicheAnalysis;
  generated_prompts: {
    domain_prompt: string;
    category_prompt: string;
    role_overrides: Record<string, string>;
  };
  workflow_config: CEOWorkflowConfig;
}

export interface CEOSetupResponse {
  config_id: string;
  domain: string;
  category: string;
  analysis: CEOAnalysis;
  prompts_stored: number;
  kv_keys_written: string[];
}

export interface CEOConfigResponse {
  id: string;
  domain_id: string;
  category_id: string;
  domain_name: string;
  category_name: string;
  analysis: CEOAnalysis;
  prompts_stored: number;
  kv_keys: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CEOConfigSummary {
  id: string;
  domain_id: string;
  category_id: string;
  domain_name: string;
  category_name: string;
  prompts_stored: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// --- Scheduler ---

export interface ScheduleRunEntry {
  id: string;
  schedule_id: string;
  products_created: number;
  products_approved: number;
  products_flagged: number;
  status: string;
  started_at: string;
  completed_at?: string;
}

export interface ScheduleTickResult {
  executed: number;
  results: Array<{ schedule_id: string; schedule_name: string; products_created: number; status: string }>;
}

// --- Campaigns ---

export interface CampaignProgress {
  campaign: Campaign;
  daily_target: number;
  days_remaining: number;
  completion_percentage: number;
  on_track: boolean;
  products_per_day_needed: number;
}

// --- Revenue ---

export interface RevenueDashboardParams {
  platform?: string;
  domain_id?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface ProductRevenueDetail {
  product_id: string;
  total_revenue: number;
  total_orders: number;
  total_quantity: number;
  by_platform: Array<{ platform: string; revenue: number; orders: number; quantity: number }>;
}

// --- Recycler ---

export interface TopSellerProduct {
  id: string;
  name: string;
  niche: string;
  domain_id: string;
  category_id: string;
  domain_name: string;
  category_name: string;
  total_revenue: number;
  total_orders: number;
  total_quantity: number;
}

export interface ProductAnalysisResult {
  product_name: string;
  domain: string;
  category: string;
  niche: string;
  revenue: number;
  orders: number;
  why_it_sells: string[];
  keywords: string[];
  positioning: string;
  price_point: string;
  target_audience: string;
  strengths: string[];
}

// --- Localization ---

export interface LanguageOption {
  code: string;
  name: string;
  locale: string;
  currency: string;
  marketplace_note: string;
}

export interface LocalizationCandidate {
  id: string;
  name: string;
  niche: string;
  language: string;
  domain_id: string;
  category_id: string;
  domain_name: string;
  category_name: string;
  total_revenue: number;
  total_orders: number;
}

// --- Daily Briefings ---

export interface BriefingSectionItem {
  headline: string;
  detail: string;
  confidence?: "high" | "medium" | "low";
  domain?: string;
  tags?: string[];
}

export interface BriefingSectionData {
  type: "trends" | "predictions" | "opportunities" | "action_items" | "niche_hacks";
  title: string;
  items: BriefingSectionItem[];
}

export interface BriefingResponse {
  id: string;
  briefing_date: string;
  title: string;
  summary: string;
  sections: BriefingSectionData[];
  domains_analyzed?: string[];
  focus_keywords?: string[];
  ai_model_used?: string;
  tokens_used: number;
  status: "generating" | "completed" | "failed";
  generated_at: string;
  created_at: string;
}

export interface BriefingSettingsData {
  id: string;
  user_timezone: string;
  briefing_hour: number;
  briefing_enabled: boolean;
  focus_domains?: string[];
  focus_keywords?: string[];
  briefing_types: string[];
  last_generated_at?: string;
  created_at?: string;
  updated_at?: string;
}
