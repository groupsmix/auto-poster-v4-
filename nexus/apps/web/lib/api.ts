// API client utility for nexus-router API
// All routes are under /api/

import type {
  Domain,
  Category,
  PromptTemplate,
  AIModel,
  Product,
  ProductStatus,
  Asset,
  WorkflowRun,
  WorkflowStep,
  Platform,
  SocialChannel,
  Schedule,
  Campaign,
  PlatformConnection,
  RevenueDashboard,
  ROIDashboard,
  ROIReport,
  ROISnapshot,
  NicheCost,
  RecyclerJob,
  RecyclerVariation,
  LocalizationJob,
  LocalizedProduct,
  ChatMessage,
  ChatConversation,
  ChatAction,
  ChatActionResult,
  ChatResponse,
} from "@nexus/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Retry wrapper for fetch: retries up to `retries` times with 1s delay
 * for network errors and 5xx responses. Does not retry 4xx (client errors).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) return response;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Max retries exceeded");
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {} } = options;

  // Add auth token if available (8.4)
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("nexus_token")
      : process.env.DASHBOARD_SECRET;

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: authHeaders,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetchWithRetry(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`,
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "POST", body }),

  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "PUT", body }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: "DELETE" }),

  // Domain endpoints
  domains: {
    list: () => request<Domain[]>("/domains"),
    get: (slug: string) => request<Domain>(`/domains/${slug}`),
    create: (data: { name: string; description?: string; icon?: string }) =>
      request<Domain>("/domains", { method: "POST", body: data }),
    update: (id: string, data: Partial<Domain>) =>
      request<Domain>(`/domains/${id}`, { method: "PUT", body: data }),
    delete: (id: string) =>
      request<void>(`/domains/${id}`, { method: "DELETE" }),
    reorder: (ids: string[]) =>
      request<void>("/domains/reorder", { method: "POST", body: { ids } }),
  },

  // Category endpoints
  categories: {
    list: (domainId: string) =>
      request<Category[]>(`/domains/${domainId}/categories`),
    get: (domainId: string, slug: string) =>
      request<Category>(`/domains/${domainId}/categories/${slug}`),
    create: (domainId: string, data: { name: string; description?: string; auto_setup?: boolean; niche_hint?: string; language?: string }) =>
      request<Category & { ceo_setup?: string; ceo_data?: CEOSetupResponse; ceo_error?: string }>("/categories", { method: "POST", body: { domain_id: domainId, ...data } }),
    update: (domainId: string, id: string, data: Partial<Category>) =>
      request<Category>(`/categories/${id}`, { method: "PUT", body: data }),
    delete: (domainId: string, id: string) =>
      request<void>(`/categories/${id}`, { method: "DELETE" }),
    reorder: (domainId: string, ids: string[]) =>
      request<void>(`/domains/${domainId}/categories/reorder`, { method: "POST", body: { ids } }),
  },

  // Prompt template endpoints
  prompts: {
    list: (layer?: string) => {
      const query = layer ? `?layer=${layer}` : "";
      return request<PromptTemplate[]>(`/prompts${query}`);
    },
    get: (id: string) => request<PromptTemplate>(`/prompts/${id}`),
    update: (id: string, data: { prompt: string }) =>
      request<PromptTemplate>(`/prompts/${id}`, { method: "PUT", body: data }),
    // NOTE: history() and revert() removed — no prompt_versions table exists
    // in the D1 schema, so these endpoints have no backing storage.
    // Add a prompt_versions table if version history is needed in the future.
    test: (id: string) =>
      request<{ assembled: string }>(`/prompts/${id}/test`, {
        method: "POST",
        body: {},
      }),
  },

  // AI model endpoints
  aiModels: {
    list: () => request<AIModel[]>("/ai/models"),
    get: (id: string) => request<AIModel>(`/ai/models/${id}`),
    addKey: (id: string, apiKey: string) =>
      request<AIModel>(`/ai/models/${id}/key`, {
        method: "POST",
        body: { api_key: apiKey },
      }),
    removeKey: (id: string) =>
      request<AIModel>(`/ai/models/${id}/key`, { method: "DELETE" }),
    reorder: (taskType: string, modelIds: string[]) =>
      request<void>(`/ai/models/reorder`, {
        method: "POST",
        body: { task_type: taskType, model_ids: modelIds },
      }),
  },

  // Product endpoints
  products: {
    list: (params?: ProductListParams) => {
      const query = params
        ? "?" + new URLSearchParams(params as Record<string, string>).toString()
        : "";
      return request<Product[]>(`/products${query}`);
    },
    get: (id: string) => request<Product>(`/products/${id}`),
    delete: (id: string) =>
      request<void>(`/products/${id}`, { method: "DELETE" }),
  },

  // Review endpoints
  reviews: {
    pending: () => request<ReviewItem[]>("/reviews?status=pending_review"),
    inRevision: () => request<ReviewItem[]>("/reviews?status=in_revision"),
    history: () => request<ReviewItem[]>("/reviews/history"),
    get: (productId: string) =>
      request<ReviewDetail>(`/reviews/${productId}`),
    approve: (productId: string) =>
      request<void>(`/reviews/${productId}/approve`, { method: "POST", body: {} }),
    reject: (productId: string, feedback: string) =>
      request<void>(`/reviews/${productId}/reject`, {
        method: "POST",
        body: { feedback },
      }),
  },

  // Publishing endpoints
  publishing: {
    ready: () => request<PublishableProduct[]>("/publish/ready"),
    publish: (productId: string, data: { platforms: string[]; channels: string[] }) =>
      request<void>(`/publish/${productId}`, {
        method: "POST",
        body: data,
      }),
    export: (format: "json" | "csv") =>
      request<string>(`/export/full?format=${format}`),
  },

  // Asset / Content endpoints
  assets: {
    list: (params?: Record<string, string>) => {
      const query = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return request<Asset[]>(`/assets${query}`);
    },
    delete: (id: string) =>
      request<void>(`/assets/${id}`, { method: "DELETE" }),
  },

  // Platform endpoints
  platforms: {
    list: () => request<PlatformFull[]>("/platforms"),
    get: (id: string) => request<PlatformFull>(`/platforms/${id}`),
    create: (data: Omit<PlatformFull, "id">) =>
      request<PlatformFull>("/platforms", { method: "POST", body: data }),
    update: (id: string, data: Partial<PlatformFull>) =>
      request<PlatformFull>(`/platforms/${id}`, { method: "PUT", body: data }),
    delete: (id: string) =>
      request<void>(`/platforms/${id}`, { method: "DELETE" }),
  },

  // Social channel endpoints
  socialChannels: {
    list: () => request<SocialChannelFull[]>("/social-channels"),
    get: (id: string) => request<SocialChannelFull>(`/social-channels/${id}`),
    create: (data: Omit<SocialChannelFull, "id">) =>
      request<SocialChannelFull>("/social-channels", { method: "POST", body: data }),
    update: (id: string, data: Partial<SocialChannelFull>) =>
      request<SocialChannelFull>(`/social-channels/${id}`, { method: "PUT", body: data }),
    delete: (id: string) =>
      request<void>(`/social-channels/${id}`, { method: "DELETE" }),
  },

  // Settings endpoints
  settings: {
    get: (key: string) => request<{ value: string }>(`/settings/${key}`),
    getAll: () => request<SettingsMap>("/settings"),
    update: (key: string, value: string) =>
      request<void>(`/settings/${key}`, { method: "PUT", body: { value } }),
      bulkUpdate: (settings: Partial<SettingsMap>) =>
        request<void>("/settings", { method: "PUT", body: settings }),
  },

  // Analytics endpoints (V4)
  analytics: {
    summary: () => request<AnalyticsSummary>("/analytics/summary"),
    aiUsageOverTime: () => request<AIUsageOverTime[]>("/analytics/ai-usage"),
    costBreakdown: () => request<CostBreakdownItem[]>("/analytics/cost-breakdown"),
    cacheHitTrend: () => request<CacheHitTrendItem[]>("/analytics/cache-trend"),
    productsByDomain: () => request<DomainBreakdownItem[]>("/analytics/products-by-domain"),
    productsByCategory: () => request<CategoryBreakdownItem[]>("/analytics/products-by-category"),
    aiLeaderboard: () => request<AILeaderboardEntry[]>("/analytics/ai-leaderboard"),
    /** Single dashboard endpoint that returns all analytics data in one request (5.4) */
    dashboard: () => request<AnalyticsDashboard>("/analytics/dashboard"),
  },

  // History endpoints
  history: {
    listRuns: (params?: RunListParams) => {
      const query = params
        ? "?" + new URLSearchParams(params as Record<string, string>).toString()
        : "";
      return request<WorkflowRun[]>(`/history/runs${query}`);
    },
    getRunSteps: (runId: string) =>
      request<WorkflowStep[]>(`/history/runs/${runId}/steps`),
    getRevisions: (productId: string) =>
      request<RevisionEntry[]>(`/history/products/${productId}/revisions`),
  },

  // API Key management
  apiKeys: {
    list: () => request<APIKeyEntry[]>("/api-keys"),
    add: (keyName: string, apiKey: string) =>
      request<void>(`/api-keys/${keyName}`, { method: "POST", body: { api_key: apiKey } }),
    remove: (keyName: string) =>
      request<void>(`/api-keys/${keyName}`, { method: "DELETE" }),
  },

  // Scheduler endpoints (Phase 1.1)
  schedules: {
    list: () => request<Schedule[]>("/schedules"),
    get: (id: string) => request<Schedule>(`/schedules/${id}`),
    create: (data: Partial<Schedule>) =>
      request<Schedule>("/schedules", { method: "POST", body: data }),
    update: (id: string, data: Partial<Schedule>) =>
      request<Schedule>(`/schedules/${id}`, { method: "PUT", body: data }),
    delete: (id: string) =>
      request<void>(`/schedules/${id}`, { method: "DELETE" }),
    toggle: (id: string) =>
      request<Schedule>(`/schedules/${id}/toggle`, { method: "POST", body: {} }),
    runs: (id: string) =>
      request<ScheduleRunEntry[]>(`/schedules/${id}/runs`),
    tick: () =>
      request<ScheduleTickResult>("/schedules/tick", { method: "POST", body: {} }),
  },

  // Campaign endpoints (Phase 1.3)
  campaigns: {
    list: () => request<Campaign[]>("/campaigns"),
    get: (id: string) => request<Campaign>(`/campaigns/${id}`),
    create: (data: Partial<Campaign>) =>
      request<Campaign>("/campaigns", { method: "POST", body: data }),
    update: (id: string, data: Partial<Campaign>) =>
      request<Campaign>(`/campaigns/${id}`, { method: "PUT", body: data }),
    delete: (id: string) =>
      request<void>(`/campaigns/${id}`, { method: "DELETE" }),
    progress: (id: string) =>
      request<CampaignProgress>(`/campaigns/${id}/progress`),
  },

  // Revenue endpoints (Phase 2)
  revenue: {
    connections: {
      list: () => request<PlatformConnection[]>("/revenue/connections"),
      get: (id: string) => request<PlatformConnection>(`/revenue/connections/${id}`),
      create: (data: Partial<PlatformConnection>) =>
        request<PlatformConnection>("/revenue/connections", { method: "POST", body: data }),
      update: (id: string, data: Partial<PlatformConnection>) =>
        request<PlatformConnection>(`/revenue/connections/${id}`, { method: "PUT", body: data }),
      delete: (id: string) =>
        request<void>(`/revenue/connections/${id}`, { method: "DELETE" }),
      sync: (id: string) =>
        request<{ matched: number }>(`/revenue/connections/${id}/sync`, { method: "POST", body: {} }),
    },
    dashboard: (params?: RevenueDashboardParams) => {
      const query = params
        ? "?" + new URLSearchParams(params as Record<string, string>).toString()
        : "";
      return request<RevenueDashboard>(`/revenue/dashboard${query}`);
    },
    byProduct: (productId: string) =>
      request<ProductRevenueDetail>(`/revenue/products/${productId}`),
  },

  // ROI Optimizer / Niche Killer endpoints (Phase 2.5)
  roi: {
    costs: {
      list: (params?: { domain_id?: string; niche?: string }) => {
        const query = params
          ? "?" + new URLSearchParams(params as Record<string, string>).toString()
          : "";
        return request<NicheCost[]>(`/roi/costs${query}`);
      },
      add: (data: { domain_id: string; category_id?: string; niche?: string; cost_type?: string; amount: number; currency?: string; description?: string; product_id?: string }) =>
        request<{ id: string }>("/roi/costs", { method: "POST", body: data }),
      delete: (id: string) =>
        request<void>(`/roi/costs/${id}`, { method: "DELETE" }),
    },
    snapshots: {
      generate: (data: { domain_id: string; category_id?: string; niche?: string; period?: string; period_start: string; period_end: string }) =>
        request<{ id: string }>("/roi/snapshots", { method: "POST", body: data }),
    },
    reports: {
      list: () => request<ROIReport[]>("/roi/reports"),
      generate: (data: { period_start: string; period_end: string; report_type?: string }) =>
        request<{ id: string }>("/roi/reports", { method: "POST", body: data }),
    },
    dashboard: (params?: { period?: string; domain_id?: string }) => {
      const query = params
        ? "?" + new URLSearchParams(params as Record<string, string>).toString()
        : "";
      return request<ROIDashboard>(`/roi/dashboard${query}`);
    },
  },

  // Smart Product Recycler endpoints (Phase 3)
  recycler: {
    topSellers: (limit?: number) =>
      request<TopSellerProduct[]>(`/recycler/top-sellers${limit ? `?limit=${limit}` : ""}`),
    analyze: (productId: string) =>
      request<ProductAnalysisResult>(`/recycler/analyze/${productId}`),
    jobs: {
      list: (params?: { status?: string }) => {
        const query = params
          ? "?" + new URLSearchParams(params as Record<string, string>).toString()
          : "";
        return request<RecyclerJob[]>(`/recycler/jobs${query}`);
      },
      get: (id: string) => request<RecyclerJob>(`/recycler/jobs/${id}`),
      create: (data: { source_product_id: string; strategy?: string; variations_requested?: number }) =>
        request<{ id: string }>("/recycler/jobs", { method: "POST", body: data }),
      delete: (id: string) =>
        request<void>(`/recycler/jobs/${id}`, { method: "DELETE" }),
      generate: (id: string) =>
        request<{ variations: Array<{ id: string; type: string; label: string }> }>(`/recycler/jobs/${id}/generate`, { method: "POST", body: {} }),
      variations: (id: string) =>
        request<RecyclerVariation[]>(`/recycler/jobs/${id}/variations`),
    },
  },

  // Multi-Language Printer endpoints (Phase 3)
  localization: {
    languages: () => request<LanguageOption[]>("/localization/languages"),
    candidates: (limit?: number) =>
      request<LocalizationCandidate[]>(`/localization/candidates${limit ? `?limit=${limit}` : ""}`),
    jobs: {
      list: (params?: { status?: string }) => {
        const query = params
          ? "?" + new URLSearchParams(params as Record<string, string>).toString()
          : "";
        return request<LocalizationJob[]>(`/localization/jobs${query}`);
      },
      get: (id: string) => request<LocalizationJob>(`/localization/jobs/${id}`),
      create: (data: { source_product_id: string; languages: string[] }) =>
        request<{ id: string }>("/localization/jobs", { method: "POST", body: data }),
      delete: (id: string) =>
        request<void>(`/localization/jobs/${id}`, { method: "DELETE" }),
      execute: (id: string) =>
        request<{ completed: string[]; failed: string[] }>(`/localization/jobs/${id}/execute`, { method: "POST", body: {} }),
      products: (id: string) =>
        request<LocalizedProduct[]>(`/localization/jobs/${id}/products`),
    },
  },

  // Chatbot endpoints
  chatbot: {
    /** Send a message to the AI chatbot */
    chat: (message: string, conversationId?: string) =>
      request<ChatResponse>("/chatbot/chat", {
        method: "POST",
        body: { message, conversation_id: conversationId },
      }),
    /** Execute proposed actions from the chatbot */
    execute: (conversationId: string, messageId: string, actionIds: string[]) =>
      request<{ results: ChatActionResult[]; summary_message: ChatMessage }>(
        "/chatbot/execute",
        {
          method: "POST",
          body: { conversation_id: conversationId, message_id: messageId, action_ids: actionIds },
        }
      ),
    /** List all conversations */
    listConversations: (limit?: number, offset?: number) => {
      const params = new URLSearchParams();
      if (limit) params.set("limit", String(limit));
      if (offset) params.set("offset", String(offset));
      const query = params.toString() ? `?${params.toString()}` : "";
      return request<ChatConversation[]>(`/chatbot/history${query}`);
    },
    /** Get messages for a conversation */
    getMessages: (conversationId: string) =>
      request<ChatMessage[]>(`/chatbot/history/${conversationId}`),
    /** Delete a conversation */
    deleteConversation: (conversationId: string) =>
      request<void>(`/chatbot/history/${conversationId}`, { method: "DELETE" }),
  },

  // AI CEO / Auto-Orchestrator endpoints
  aiCeo: {
    /** Run full CEO analysis for a domain + category */
    setup: (data: { domain_id: string; category_id: string; niche_hint?: string; language?: string }) =>
      request<CEOSetupResponse>("/ai-ceo/setup", { method: "POST", body: data }),
    /** Get existing CEO configuration for a category */
    getConfig: (categoryId: string) =>
      request<CEOConfigResponse>(`/ai-ceo/config/${categoryId}`),
    /** Re-run CEO analysis for an existing category */
    refresh: (categoryId: string, data?: { niche_hint?: string; language?: string }) =>
      request<CEOSetupResponse>(`/ai-ceo/refresh/${categoryId}`, { method: "POST", body: data ?? {} }),
    /** List all CEO configuration history */
    history: (page?: number, pageSize?: number) => {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (pageSize) params.set("pageSize", String(pageSize));
      const query = params.toString() ? `?${params.toString()}` : "";
      return request<CEOConfigSummary[]>(`/ai-ceo/history${query}`);
    },
  },
};

// --- Frontend-specific types (not in @nexus/shared) ---

interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  prompt: string;
  updated_at: string;
}

interface ReviewItem {
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

interface ReviewDetail {
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

interface PlatformVariantData {
  platform: string;
  title: string;
  description: string;
  tags: string[];
  price: number;
  scores: { seo: number; title: number; tags: number };
}

interface SocialVariantData {
  channel: string;
  caption: string;
  hashtags: string[];
  post_type: string;
  scheduled_time?: string;
}

interface PublishableProduct {
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

// PlatformFull and SocialChannelFull are the same as the shared types
// but with all optional fields required (used when fetching a single record).
interface PlatformFull extends Platform {
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

interface SocialChannelFull extends SocialChannel {
  caption_max_chars: number | undefined;
  hashtag_count: number | undefined;
  tone: string;
  format: string;
  content_types: string[];
}

// Analytics types (V4)
interface AnalyticsSummary {
  total_products_all_time: number;
  total_products_this_month: number;
  total_ai_calls_all_time: number;
  total_ai_calls_this_month: number;
  cache_hit_rate: number;
  total_cost: number;
  avg_workflow_time_ms: number;
  cost_savings: number;
}

interface AIUsageOverTime {
  date: string;
  provider: string;
  tokens: number;
}

interface CostBreakdownItem {
  provider: string;
  cost: number;
}

interface CacheHitTrendItem {
  date: string;
  hit_rate: number;
}

interface DomainBreakdownItem {
  domain: string;
  count: number;
}

interface CategoryBreakdownItem {
  category: string;
  count: number;
}

interface AILeaderboardEntry {
  id: string;
  name: string;
  provider: string;
  health_score: number;
  avg_latency_ms: number;
  total_calls: number;
  total_failures: number;
}

/** Combined analytics dashboard response (5.4) */
interface AnalyticsDashboard {
  summary: AnalyticsSummary;
  aiUsage: AIUsageOverTime[];
  costBreakdown: CostBreakdownItem[];
  cacheHitTrend: CacheHitTrendItem[];
  productsByDomain: DomainBreakdownItem[];
  productsByCategory: CategoryBreakdownItem[];
  leaderboard: AILeaderboardEntry[];
}

/** Query parameters for product listing */
interface ProductListParams {
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
interface RunListParams {
  status?: string;
  limit?: string;
  offset?: string;
}

interface RevisionEntry {
  id: string;
  product_id: string;
  version: number;
  feedback?: string;
  ai_score: number;
  ai_model: string;
  reviewed_at: string;
  decision: string;
}

// Settings types
/** Settings stored as key-value pairs in D1 */
type SettingsMap = Record<
  | "social_posting_mode"
  | "default_language"
  | "ceo_review_required"
  | "auto_publish_after_approval"
  | "batch_max_products"
  | "cache_enabled"
  | "ai_gateway_enabled",
  string
>;

// API Key management types
interface APIKeyEntry {
  key_name: string;
  display_name: string;
  status: "active" | "not_set";
}

// AI CEO types
interface CEONicheAnalysis {
  market_overview: string;
  target_audience: string;
  buyer_psychology: string;
  price_positioning: string;
  competitive_landscape: string;
  demand_signals: string[];
  key_differentiators: string[];
}

interface CEOWorkflowConfig {
  recommended_platforms: string[];
  recommended_social_channels: string[];
  content_tone: string;
  content_style: string;
  pricing_strategy: string;
  seo_focus_keywords: string[];
  quality_threshold: number;
}

interface CEOAnalysis {
  niche_analysis: CEONicheAnalysis;
  generated_prompts: {
    domain_prompt: string;
    category_prompt: string;
    role_overrides: Record<string, string>;
  };
  workflow_config: CEOWorkflowConfig;
}

interface CEOSetupResponse {
  config_id: string;
  domain: string;
  category: string;
  analysis: CEOAnalysis;
  prompts_stored: number;
  kv_keys_written: string[];
}

interface CEOConfigResponse {
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

interface CEOConfigSummary {
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

// Scheduler types
interface ScheduleRunEntry {
  id: string;
  schedule_id: string;
  products_created: number;
  products_approved: number;
  products_flagged: number;
  status: string;
  started_at: string;
  completed_at?: string;
}

interface ScheduleTickResult {
  executed: number;
  results: Array<{ schedule_id: string; schedule_name: string; products_created: number; status: string }>;
}

// Campaign types
interface CampaignProgress {
  campaign: Campaign;
  daily_target: number;
  days_remaining: number;
  completion_percentage: number;
  on_track: boolean;
  products_per_day_needed: number;
}

// Revenue types
interface RevenueDashboardParams {
  platform?: string;
  domain_id?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
}

interface ProductRevenueDetail {
  product_id: string;
  total_revenue: number;
  total_orders: number;
  total_quantity: number;
  by_platform: Array<{ platform: string; revenue: number; orders: number; quantity: number }>;
}

// ROI Optimizer types
interface TopSellerProduct {
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

interface ProductAnalysisResult {
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

// Localization types
interface LanguageOption {
  code: string;
  name: string;
  locale: string;
  currency: string;
  marketplace_note: string;
}

interface LocalizationCandidate {
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

export type {
  Domain,
  Category,
  PromptTemplate,
  PromptVersion,
  AIModel,
  Product,
  ProductStatus,
  ReviewItem,
  ReviewDetail,
  PlatformVariantData,
  SocialVariantData,
  PublishableProduct,
  Asset,
  Platform,
  PlatformFull,
  SocialChannel,
  SocialChannelFull,
  AnalyticsSummary,
  AIUsageOverTime,
  CostBreakdownItem,
  CacheHitTrendItem,
  DomainBreakdownItem,
  CategoryBreakdownItem,
  AILeaderboardEntry,
  AnalyticsDashboard,
  WorkflowRun,
  WorkflowStep,
  RevisionEntry,
  SettingsMap,
  APIKeyEntry,
  ProductListParams,
  RunListParams,
  CEONicheAnalysis,
  CEOWorkflowConfig,
  CEOAnalysis,
  CEOSetupResponse,
  CEOConfigResponse,
  CEOConfigSummary,
  Schedule,
  Campaign,
  PlatformConnection,
  RevenueDashboard,
  ScheduleRunEntry,
  ScheduleTickResult,
  CampaignProgress,
  RevenueDashboardParams,
  ProductRevenueDetail,
  ROIDashboard,
  ROIReport,
  ROISnapshot,
  NicheCost,
  RecyclerJob,
  RecyclerVariation,
  LocalizationJob,
  LocalizedProduct,
  TopSellerProduct,
  ProductAnalysisResult,
  LanguageOption,
  LocalizationCandidate,
  ChatMessage,
  ChatConversation,
  ChatAction,
  ChatActionResult,
  ChatResponse,
};
