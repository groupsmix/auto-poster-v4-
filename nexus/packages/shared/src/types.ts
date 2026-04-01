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
  | "audio"
  | "reasoning";

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

export type StepStatusType =
  | "waiting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type VariantStatus =
  | "draft"
  | "ready"
  | "published";

export type ScheduleRunStatus =
  | "running"
  | "completed"
  | "failed";

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
  domain_name?: string;
  category_name?: string;
  platforms?: string[];
  created_at: string;
  updated_at?: string;
}

// --- Workflow ---

export interface WorkflowRun {
  id: string;
  product_id: string;
  product_name?: string;
  batch_id?: string;
  status: WorkflowStatus;
  started_at?: string;
  completed_at?: string;
  current_step?: string;
  total_steps?: number;
  total_tokens: number;
  total_cost: number;
  cache_hits: number;
  domain_name?: string;
  category_name?: string;
  ai_models_used?: string[];
  duration_ms?: number;
  error?: string;
}

export interface WorkflowStep {
  id: string;
  run_id: string;
  step_name: string;
  step_order: number;
  status: StepStatusType;
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
  product_name?: string;
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
  status: VariantStatus;
  published_at?: string;
}

export interface SocialVariant {
  id: string;
  product_id: string;
  channel_id: string;
  content: Record<string, unknown>;
  status: VariantStatus;
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

export interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  prompt: string;
  name?: string;
  layer?: string;
  changed_at: string;
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

// --- Schedules ---

export type ScheduleStatus = "active" | "paused" | "completed";

export interface Schedule {
  id: string;
  name: string;
  domain_id: string;
  category_id?: string;
  niche_keywords?: string[];
  products_per_run: number;
  interval_hours: number;
  platforms?: string[];
  social_channels?: string[];
  language: string;
  auto_approve_threshold: number;
  auto_revise_min_score: number;
  max_auto_revisions: number;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  total_products_created: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRun {
  id: string;
  schedule_id: string;
  status: ScheduleRunStatus;
  products_created: number;
  products_approved: number;
  products_failed: number;
  error?: string;
  started_at: string;
  completed_at?: string;
}

// --- Campaigns ---

export type CampaignStatus = "active" | "paused" | "completed" | "cancelled";

export interface Campaign {
  id: string;
  name: string;
  domain_id: string;
  category_id?: string;
  target_count: number;
  daily_target: number;
  deadline?: string;
  niche_keywords?: string[];
  platforms?: string[];
  social_channels?: string[];
  language: string;
  auto_approve_threshold: number;
  status: CampaignStatus;
  products_created: number;
  products_approved: number;
  products_published: number;
  created_at: string;
  updated_at: string;
}

// --- Revenue Tracker ---

export type PlatformConnectionAuthType = "api_key" | "oauth";
export type SyncStatus = "idle" | "syncing" | "error";

export interface PlatformConnection {
  id: string;
  platform: string;
  store_name?: string;
  auth_type: PlatformConnectionAuthType;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  shop_domain?: string;
  is_active: boolean;
  last_sync_at?: string;
  sync_status: SyncStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RevenueRecord {
  id: string;
  connection_id: string;
  platform: string;
  product_id?: string;
  external_order_id?: string;
  external_product_id?: string;
  external_product_title?: string;
  sku?: string;
  quantity: number;
  revenue: number;
  currency: string;
  fees: number;
  net_revenue: number;
  order_date: string;
  synced_at: string;
  metadata?: Record<string, unknown>;
}

export interface RevenueDailySummary {
  id: string;
  connection_id: string;
  platform: string;
  domain_id?: string;
  category_id?: string;
  date: string;
  orders_count: number;
  units_sold: number;
  gross_revenue: number;
  fees: number;
  net_revenue: number;
  views: number;
  favorites: number;
  conversion_rate: number;
  currency: string;
}

export interface RevenueDashboard {
  total_revenue: number;
  total_orders: number;
  total_products_sold: number;
  by_platform: Array<{
    platform: string;
    revenue: number;
    orders: number;
    products: number;
  }>;
  by_domain: Array<{
    domain_id: string;
    domain_name: string;
    revenue: number;
    orders: number;
    products: number;
    avg_per_product: number;
  }>;
  by_category: Array<{
    category_id: string;
    category_name: string;
    domain_id: string;
    revenue: number;
    orders: number;
    products: number;
    avg_per_product: number;
  }>;
  top_products: Array<{
    product_id: string;
    product_name: string;
    platform: string;
    revenue: number;
    orders: number;
  }>;
  daily_trend: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
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
  AI: Fetcher & {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
  };

  // AI Gateway
  AI_GATEWAY: Fetcher;

  // Cloudflare Account Config (used by AI Gateway routing)
  CF_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;

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
  SEGMIND_API_KEY?: string;
  CLIPDROP_API_KEY?: string;
  UDIO_API_KEY?: string;
  MINIMAX_API_KEY?: string;
  TOGETHER_API_KEY?: string;

  // Index signature for dynamic secret access
  [key: string]: unknown;
}

// --- Chatbot Types ---

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  proposed_actions?: ChatAction[];
  action_results?: ChatActionResult[];
  created_at: string;
}

export interface ChatConversation {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

/** An action the chatbot proposes to execute */
export interface ChatAction {
  id: string;
  type: ChatActionType;
  label: string;
  description: string;
  params: Record<string, unknown>;
}

export type ChatActionType =
  | "create_domain"
  | "create_category"
  | "start_workflow"
  | "update_setting"
  | "add_api_key"
  | "ceo_setup"
  | "create_platform"
  | "create_social_channel"
  | "approve_product"
  | "reject_product"
  | "publish_product"
  | "update_prompt"
  | "general_query";

export interface ChatActionResult {
  action_id: string;
  success: boolean;
  message: string;
  data?: unknown;
}

/** Request body for /api/chatbot/chat */
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

/** Response from /api/chatbot/chat */
export interface ChatResponse {
  conversation_id: string;
  message: ChatMessage;
  /** If the assistant wants to confirm actions before executing */
  pending_actions?: ChatAction[];
}

/** Request body for /api/chatbot/execute */
export interface ChatExecuteRequest {
  conversation_id: string;
  message_id: string;
  action_ids: string[];
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

// --- Auto-Approve Settings ---

export interface AutoApproveSettings {
  auto_approve_threshold: number;
  auto_revise_min_score: number;
  max_auto_revisions: number;
}

// --- ROI Optimizer / Niche Killer ---

export type ROICostType = "ai_api" | "time" | "platform_fee" | "other";

export interface NicheCost {
  id: string;
  domain_id: string;
  category_id?: string;
  niche?: string;
  cost_type: ROICostType;
  amount: number;
  currency: string;
  description?: string;
  product_id?: string;
  recorded_at: string;
}

export interface ROISnapshot {
  id: string;
  domain_id: string;
  category_id?: string;
  niche?: string;
  period: string;
  period_start: string;
  period_end: string;
  total_revenue: number;
  total_cost: number;
  net_profit: number;
  roi_multiplier: number;
  products_count: number;
  orders_count: number;
  recommendation?: string;
  created_at: string;
}

export interface ROIReport {
  id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  winners: ROINicheEntry[];
  losers: ROINicheEntry[];
  recommendations: string[];
  total_revenue: number;
  total_cost: number;
  overall_roi: number;
  created_at: string;
}

export interface ROINicheEntry {
  niche: string;
  domain_id?: string;
  category_id?: string;
  revenue: number;
  cost: number;
  roi_multiplier: number;
  products_count: number;
  orders_count: number;
}

export interface ROIDashboard {
  snapshots: ROISnapshot[];
  latest_report?: ROIReport;
  top_niches: ROINicheEntry[];
  worst_niches: ROINicheEntry[];
  total_revenue: number;
  total_cost: number;
  overall_roi: number;
}

// --- Smart Product Recycler ---

export type RecyclerStrategy = "angle" | "bundle" | "seasonal" | "regional" | "all";
export type RecyclerJobStatus = "pending" | "running" | "completed" | "failed";

export interface RecyclerJob {
  id: string;
  source_product_id: string;
  source_product_name?: string;
  strategy: RecyclerStrategy;
  status: RecyclerJobStatus;
  variations_requested: number;
  variations_created: number;
  variations_approved: number;
  config?: Record<string, unknown>;
  analysis?: ProductAnalysis;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface ProductAnalysis {
  why_it_sells: string[];
  keywords: string[];
  positioning: string;
  price_point: string;
  target_audience: string;
  strengths: string[];
}

export interface RecyclerVariation {
  id: string;
  job_id: string;
  source_product_id: string;
  new_product_id?: string;
  variation_type: string;
  variation_label?: string;
  status: RecyclerJobStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// --- Multi-Language Printer ---

export type LocalizationJobStatus = "pending" | "running" | "completed" | "failed";

export interface LocalizationJob {
  id: string;
  source_product_id: string;
  source_product_name?: string;
  status: LocalizationJobStatus;
  languages_requested: string[];
  languages_completed?: string[];
  languages_failed?: string[];
  config?: Record<string, unknown>;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface LocalizedProduct {
  id: string;
  job_id: string;
  source_product_id: string;
  new_product_id?: string;
  target_language: string;
  target_locale?: string;
  status: LocalizationJobStatus;
  localization_notes?: LocalizationNotes;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface LocalizationNotes {
  currency_adapted: boolean;
  cultural_references_adapted: boolean;
  seo_keywords_localized: boolean;
  platform_specific: boolean;
  social_content_adapted: boolean;
}

// --- AI Project Builder ---

export type ProjectBuildStatus =
  | "planning"
  | "plan_complete"
  | "building"
  | "validating"
  | "fixing"
  | "completed"
  | "failed"
  | "cancelled";

export type ProjectBuildPhase = "plan" | "build" | "validate";

export type BuildAgentRole =
  | "ceo"
  | "architect"
  | "contract_generator"
  | "contract_validator"
  | "designer"
  | "db_architect"
  | "backend_dev"
  | "frontend_dev"
  | "integrator"
  | "structural_validator"
  | "code_reviewer"
  | "qa_validator"
  | "fixer";

/** Input to start a new project build */
export interface ProjectBuildInput {
  idea: string;
  tech_stack?: string;
  features?: string[];
  target_user?: string;
  design_style?: string;
}

/** The main project build entity */
export interface ProjectBuild {
  id: string;
  idea: string;
  tech_stack?: string;
  features?: string[];
  target_user?: string;
  design_style?: string;
  status: ProjectBuildStatus;
  current_phase: ProjectBuildPhase;
  current_cycle: number;
  max_cycles: number;
  quality_score?: number;
  spec?: ProjectSpec;
  blueprint?: ArchitectureBlueprint;
  validation_report?: ValidationReport;
  total_files: number;
  total_tokens: number;
  total_cost: number;
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

/** Project Specification Document — output of AI CEO */
export interface ProjectSpec {
  project_name: string;
  problem_statement: string;
  target_users: string;
  core_features: string[];
  pages: string[];
  data_entities: string[];
  user_flows: string[];
  tech_stack: {
    frontend: string;
    backend: string;
    database: string;
    styling: string;
  };
  integrations: string[];
  auth_flow: string;
}

/** Architecture Blueprint — output of AI Architect */
export interface ArchitectureBlueprint {
  database_schema: DatabaseSchemaContract;
  api_endpoints: ApiEndpointContract[];
  pages: PageContract[];
  components: ComponentContract[];
  file_structure: string[];
  auth_flow: string;
  state_management: string;
}

/** Database schema contract */
export interface DatabaseSchemaContract {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      primary_key?: boolean;
      nullable?: boolean;
      default_value?: string;
      references?: string;
    }>;
  }>;
}

/** API endpoint contract */
export interface ApiEndpointContract {
  method: string;
  path: string;
  description: string;
  request_body?: Record<string, unknown>;
  response_shape: Record<string, unknown>;
  auth_required: boolean;
}

/** Page contract */
export interface PageContract {
  route: string;
  name: string;
  layout: string;
  components: string[];
  data_requirements: string[];
}

/** Component contract */
export interface ComponentContract {
  name: string;
  props: Record<string, string>;
  state?: Record<string, string>;
  events?: string[];
}

/** Validation report — output of Phase 3 */
export interface ValidationReport {
  structural_score: number;
  code_review_score: number;
  qa_score: number;
  overall_score: number;
  passed: boolean;
  structural_issues: ValidationIssue[];
  code_review_issues: ValidationIssue[];
  qa_issues: ValidationIssue[];
  suggestions: string[];
}

/** A single validation issue */
export interface ValidationIssue {
  file: string;
  line?: number;
  severity: "error" | "warning" | "info";
  message: string;
  suggested_fix?: string;
}

/** A step within the project build pipeline */
export interface ProjectBuildStep {
  id: string;
  build_id: string;
  phase: ProjectBuildPhase;
  agent_role: BuildAgentRole;
  step_order: number;
  status: StepStatusType;
  cycle: number;
  output?: Record<string, unknown>;
  ai_model?: string;
  tokens_used: number;
  cost: number;
  cached: boolean;
  latency_ms?: number;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

/** A generated file within the project build */
export interface ProjectBuildFile {
  id: string;
  build_id: string;
  file_path: string;
  content: string;
  agent_role: BuildAgentRole;
  cycle: number;
  language?: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

/** Progress tracking for the project builder UI */
export interface ProjectBuildProgress {
  build_id: string;
  status: ProjectBuildStatus;
  current_phase: ProjectBuildPhase;
  current_cycle: number;
  max_cycles: number;
  quality_score?: number;
  phases: {
    plan: {
      status: StepStatusType;
      steps: Array<{
        agent_role: BuildAgentRole;
        status: StepStatusType;
        ai_model?: string;
        latency_ms?: number;
      }>;
    };
    build: {
      status: StepStatusType;
      layers: Array<{
        agents: Array<{
          agent_role: BuildAgentRole;
          status: StepStatusType;
          files_generated?: number;
        }>;
      }>;
    };
    validate: {
      status: StepStatusType;
      steps: Array<{
        agent_role: BuildAgentRole;
        status: StepStatusType;
        score?: number;
        issues_found?: number;
      }>;
    };
  };
  total_files: number;
  total_tokens: number;
  total_cost: number;
}

// --- Daily Intelligence Briefings ---

export type BriefingStatus = "generating" | "completed" | "failed";

export interface BriefingSection {
  type: "trends" | "predictions" | "opportunities" | "action_items" | "niche_hacks";
  title: string;
  items: Array<{
    headline: string;
    detail: string;
    confidence?: "high" | "medium" | "low";
    domain?: string;
    tags?: string[];
  }>;
}

export interface DailyBriefing {
  id: string;
  briefing_date: string;
  title: string;
  summary: string;
  sections: BriefingSection[];
  domains_analyzed?: string[];
  focus_keywords?: string[];
  ai_model_used?: string;
  tokens_used: number;
  status: BriefingStatus;
  generated_at: string;
  created_at: string;
}

export interface BriefingSettings {
  id: string;
  user_timezone: string;
  briefing_hour: number;
  briefing_enabled: boolean;
  focus_domains?: string[];
  focus_keywords?: string[];
  briefing_types: string[];
  last_generated_at?: string;
  created_at: string;
  updated_at: string;
}
