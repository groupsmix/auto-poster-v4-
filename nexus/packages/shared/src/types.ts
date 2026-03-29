// ============================================================
// NEXUS Shared Types
// ============================================================

// --- Status & Task Union Types ---

export type WorkflowStatus =
  | "queued"
  | "running"
  | "waiting_cache"
  | "waiting_fallback"
  | "workers_ai_fallback"
  | "completed"
  | "failed"
  | "pending_review"
  | "approved"
  | "rejected"
  | "in_revision"
  | "published"
  | "cancelled";

export type TaskType =
  | "research"
  | "writing"
  | "seo"
  | "code"
  | "variation"
  | "social"
  | "humanizer"
  | "review"
  | "image"
  | "audio";

export type PromptLayer =
  | "master"
  | "role"
  | "domain"
  | "category"
  | "platform"
  | "social"
  | "review"
  | "context";

export type ProductStatus =
  | "draft"
  | "queued"
  | "running"
  | "pending_review"
  | "approved"
  | "rejected"
  | "in_revision"
  | "published"
  | "cancelled";

export type AIModelStatus =
  | "active"
  | "sleeping"
  | "rate_limited"
  | "no_key";

export type AssetType = "image" | "pdf" | "audio" | "mockup";

export type ReviewDecision = "approved" | "rejected";

export type AnalyticsEventType =
  | "workflow_complete"
  | "ai_call"
  | "cache_hit"
  | "failover"
  | "error";

// --- Domain & Category ---

export interface Domain {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  domain_id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

// --- Platform & Social ---

export interface Platform {
  id: string;
  name: string;
  slug: string;
  title_max_chars?: number;
  tag_count?: number;
  tag_max_chars?: number;
  audience?: string;
  tone?: string;
  seo_style?: string;
  description_style?: string;
  cta_style?: string;
  rules_json?: Record<string, unknown>;
  is_active: boolean;
}

export interface SocialChannel {
  id: string;
  name: string;
  slug: string;
  caption_max_chars?: number;
  hashtag_count?: number;
  tone?: string;
  format?: string;
  content_types?: string[];
  is_active: boolean;
}

// --- Products ---

export interface Product {
  id: string;
  domain_id: string;
  category_id: string;
  name?: string;
  niche?: string;
  language: string;
  user_input?: Record<string, unknown>;
  batch_id?: string;
  status: ProductStatus;
  created_at: string;
  updated_at?: string;
}

// --- Workflow ---

export interface WorkflowRun {
  id: string;
  product_id: string;
  batch_id?: string;
  status: WorkflowStatus;
  started_at?: string;
  completed_at?: string;
  current_step?: string;
  total_steps?: number;
  total_tokens: number;
  total_cost: number;
  cache_hits: number;
  error?: string;
}

export interface WorkflowStep {
  id: string;
  run_id: string;
  step_name: string;
  step_order: number;
  status: string;
  ai_used?: string;
  ai_tried?: string[];
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  tokens_used?: number;
  cost: number;
  cached: boolean;
  latency_ms?: number;
  started_at?: string;
  completed_at?: string;
}

// --- Assets ---

export interface Asset {
  id: string;
  product_id: string;
  asset_type: AssetType;
  r2_key: string;
  cf_image_id?: string;
  url: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// --- Platform & Social Variants ---

export interface PlatformVariant {
  id: string;
  product_id: string;
  platform_id: string;
  title: string;
  description: string;
  tags?: string[];
  price?: number;
  metadata?: Record<string, unknown>;
  status: string;
  published_at?: string;
}

export interface SocialVariant {
  id: string;
  product_id: string;
  channel_id: string;
  content: Record<string, unknown>;
  status: string;
  scheduled_at?: string;
  published_at?: string;
}

// --- Reviews ---

export interface Review {
  id: string;
  product_id: string;
  run_id: string;
  version: number;
  ai_score?: number;
  ai_model?: string;
  decision: ReviewDecision;
  feedback?: string;
  reviewed_at: string;
}

export interface RevisionHistory {
  id: string;
  product_id: string;
  version: number;
  output: Record<string, unknown>;
  feedback?: string;
  ai_score?: number;
  ai_model?: string;
  reviewed_at?: string;
  decision: ReviewDecision;
}

// --- Prompt Templates ---

export interface PromptTemplate {
  id: string;
  layer: PromptLayer;
  target_id?: string;
  name: string;
  prompt: string;
  version: number;
  is_active: boolean;
  updated_at: string;
}

// --- AI Models ---

export interface AIModel {
  id: string;
  name: string;
  provider?: string;
  task_type: TaskType;
  rank: number;
  api_key_secret_name?: string;
  is_workers_ai: boolean;
  status: AIModelStatus;
  rate_limit_reset_at?: string;
  daily_limit_reset_at?: string;
  is_free_tier: boolean;
  health_score: number;
  total_calls: number;
  total_failures: number;
  avg_latency_ms: number;
  notes?: string;
}

// --- Analytics ---

export interface AnalyticsEvent {
  id: string;
  event_type: AnalyticsEventType;
  product_id?: string;
  run_id?: string;
  ai_model?: string;
  tokens_used?: number;
  cost: number;
  latency_ms?: number;
  cached: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// --- Settings ---

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

// --- AI Call Result ---

export interface AICallResult {
  result: string;
  model: string;
  cached: boolean;
  tokens?: number;
}

// --- CEO Review Result ---

export interface CEOReviewResult {
  overall_score: number;
  approved: boolean;
  scores: Record<string, number>;
  issues: Array<{
    criterion: string;
    problem: string;
    fix: string;
  }>;
  revised_sections: Record<string, unknown>;
}

// --- Product Setup Input ---

export interface ProductSetupInput {
  domain_id: string;
  category_id: string;
  language?: string;
  niche?: string;
  name?: string;
  description?: string;
  keywords?: string;
  platforms: string[];
  social_channels: string[];
  social_enabled: boolean;
  posting_mode: "auto" | "manual";
  price_suggestion: "ai" | number;
  target_audience: "ai" | string;
  design_style: "ai" | string;
  batch_count: number;
}

// --- Batch Progress ---

export interface BatchProgress {
  batch_id: string;
  total: number;
  completed: number;
  current_index: number;
  products: Array<{
    id: string;
    name: string;
    status: WorkflowStatus;
  }>;
}

// --- Cloudflare Env Bindings ---

export interface Env {
  // KV Namespaces
  KV: KVNamespace;

  // D1 Database
  DB: D1Database;

  // R2 Bucket
  R2: R2Bucket;

  // Workers AI
  AI: Fetcher;

  // AI Gateway
  AI_GATEWAY: Fetcher;

  // Service Bindings (used by nexus-workflow, nexus-variation)
  NEXUS_AI: Fetcher;
  NEXUS_WORKFLOW: Fetcher;
  NEXUS_VARIATION: Fetcher;
  NEXUS_STORAGE: Fetcher;

  // Service Bindings (used by nexus-router)
  AI_SERVICE: Fetcher;
  WORKFLOW_SERVICE: Fetcher;
  VARIATION_SERVICE: Fetcher;
  STORAGE_SERVICE: Fetcher;

  // Secrets (AI API keys — optional, model sleeps if missing)
  TAVILY_API_KEY?: string;
  EXA_API_KEY?: string;
  SERPAPI_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  DASHSCOPE_API_KEY?: string;
  SILICONFLOW_API_KEY?: string;
  FIREWORKS_API_KEY?: string;
  GROQ_API_KEY?: string;
  HF_TOKEN?: string;
  FAL_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  MOONSHOT_API_KEY?: string;
  DATAFORSEO_KEY?: string;
  PRINTFUL_API_KEY?: string;
  PRINTIFY_API_KEY?: string;
  SUNO_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  MIDJOURNEY_API_KEY?: string;
  IDEOGRAM_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  CARTESIA_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  PLACEIT_API_KEY?: string;

  // Index signature for dynamic secret access
  [key: string]: unknown;
}

// --- API Response Types ---

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
