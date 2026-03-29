// API client utility for nexus-router API
// All routes are under /api/

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

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

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
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
    create: (data: { name: string; icon?: string }) =>
      request<Domain>("/domains", { method: "POST", body: data }),
    delete: (id: string) =>
      request<void>(`/domains/${id}`, { method: "DELETE" }),
  },

  // Category endpoints
  categories: {
    list: (domainId: string) =>
      request<Category[]>(`/domains/${domainId}/categories`),
    get: (domainId: string, slug: string) =>
      request<Category>(`/domains/${domainId}/categories/${slug}`),
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
    revert: (id: string, version: number) =>
      request<PromptTemplate>(`/prompts/${id}/revert`, {
        method: "POST",
        body: { version },
      }),
    test: (id: string) =>
      request<{ assembled: string }>(`/prompts/${id}/test`, {
        method: "POST",
        body: {},
      }),
  },

  // AI model endpoints
  aiModels: {
    list: () => request<AIModel[]>("/ai-models"),
    get: (id: string) => request<AIModel>(`/ai-models/${id}`),
    addKey: (id: string, apiKey: string) =>
      request<AIModel>(`/ai-models/${id}/key`, {
        method: "POST",
        body: { api_key: apiKey },
      }),
    removeKey: (id: string) =>
      request<AIModel>(`/ai-models/${id}/key`, { method: "DELETE" }),
    reorder: (taskType: string, modelIds: string[]) =>
      request<void>(`/ai-models/reorder`, {
        method: "POST",
        body: { task_type: taskType, model_ids: modelIds },
      }),
  },
};

// Re-export types used by API consumers
interface Domain {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface Category {
  id: string;
  domain_id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

interface PromptTemplate {
  id: string;
  layer: string;
  target_id: string | null;
  name: string;
  prompt: string;
  version: number;
  is_active: boolean;
  updated_at: string;
}

interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  prompt: string;
  updated_at: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  task_type: string;
  rank: number;
  api_key_secret_name: string | null;
  is_workers_ai: boolean;
  status: string;
  rate_limit_reset_at: string | null;
  daily_limit_reset_at: string | null;
  is_free_tier: boolean;
  health_score: number;
  total_calls: number;
  total_failures: number;
  avg_latency_ms: number;
  notes: string | null;
}

export type { Domain, Category, PromptTemplate, PromptVersion, AIModel, ApiResponse };
