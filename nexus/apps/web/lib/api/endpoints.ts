// ============================================================
// API endpoint definitions organized by feature
// ============================================================

import type {
  Domain,
  Category,
  PromptTemplate,
  PromptVersion,
  AIModel,
  Product,
  Asset,
  WorkflowRun,
  WorkflowStep,
  Schedule,
  Campaign,
  PlatformConnection,
  RevenueDashboard,
  ROIDashboard,
  ROIReport,
  NicheCost,
  RecyclerJob,
  RecyclerVariation,
  LocalizationJob,
  LocalizedProduct,
  ChatMessage,
  ChatConversation,
  ChatActionResult,
  ChatResponse,
  ProjectBuild,
  ProjectBuildProgress,
  ProjectBuildFile,
} from "@nexus/shared";

import { request } from "./client";

import type {
  ReviewItem,
  ReviewDetail,
  PublishableProduct,
  PlatformFull,
  SocialChannelFull,
  SettingsMap,
  AnalyticsSummary,
  AIUsageOverTime,
  CostBreakdownItem,
  CacheHitTrendItem,
  DomainBreakdownItem,
  CategoryBreakdownItem,
  AILeaderboardEntry,
  AnalyticsDashboard,
  ProductListParams,
  RunListParams,
  RevisionEntry,
  APIKeyEntry,
  CEOSetupResponse,
  CEOConfigResponse,
  CEOConfigSummary,
  ScheduleRunEntry,
  ScheduleTickResult,
  CampaignProgress,
  RevenueDashboardParams,
  ProductRevenueDetail,
  TopSellerProduct,
  ProductAnalysisResult,
  LanguageOption,
  LocalizationCandidate,
} from "./types";

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
    history: (id: string) =>
      request<PromptVersion[]>(`/prompts/${id}/history`),
    revert: (id: string, versionId: string) =>
      request<{ id: string; reverted_to_version: number }>(`/prompts/${id}/revert/${versionId}`, {
        method: "POST",
        body: {},
      }),
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

  // AI Project Builder endpoints
  projectBuilder: {
    /** Start a new project build */
    start: (data: { idea: string; tech_stack?: string; features?: string[]; target_user?: string; design_style?: string }) =>
      request<{ build_id: string; status: string }>("/project-builder", { method: "POST", body: data }),
    /** List all project builds */
    list: (page?: number, pageSize?: number) => {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (pageSize) params.set("pageSize", String(pageSize));
      const query = params.toString() ? `?${params.toString()}` : "";
      return request<{ builds: ProjectBuild[]; total: number }>(`/project-builder${query}`);
    },
    /** Get build progress */
    getProgress: (buildId: string) =>
      request<ProjectBuildProgress>(`/project-builder/${buildId}`),
    /** Get full build details */
    getDetails: (buildId: string) =>
      request<ProjectBuild>(`/project-builder/${buildId}/details`),
    /** Get generated files */
    getFiles: (buildId: string) =>
      request<{ files: ProjectBuildFile[] }>(`/project-builder/${buildId}/files`),
    /** Rebuild with feedback */
    rebuild: (buildId: string, feedback: string) =>
      request<{ build_id: string; status: string }>(`/project-builder/${buildId}/rebuild`, { method: "POST", body: { feedback } }),
    /** Cancel a build */
    cancel: (buildId: string) =>
      request<{ build_id: string; status: string }>(`/project-builder/${buildId}/cancel`, { method: "POST", body: {} }),
    /** Delete a build */
    delete: (buildId: string) =>
      request<{ deleted: boolean }>(`/project-builder/${buildId}`, { method: "DELETE" }),
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
