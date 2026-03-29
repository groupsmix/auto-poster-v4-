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
    create: (domainId: string, data: { name: string; description?: string }) =>
      request<Category>(`/domains/${domainId}/categories`, { method: "POST", body: data }),
    update: (domainId: string, id: string, data: Partial<Category>) =>
      request<Category>(`/domains/${domainId}/categories/${id}`, { method: "PUT", body: data }),
    delete: (domainId: string, id: string) =>
      request<void>(`/domains/${domainId}/categories/${id}`, { method: "DELETE" }),
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

  // Product endpoints
  products: {
    list: (params?: Record<string, string>) => {
      const query = params
        ? "?" + new URLSearchParams(params).toString()
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
    ready: () => request<PublishableProduct[]>("/publishing/ready"),
    publish: (productId: string, data: { platforms: string[]; channels: string[] }) =>
      request<void>(`/publishing/${productId}/publish`, {
        method: "POST",
        body: data,
      }),
    export: (format: "json" | "csv") =>
      request<string>(`/publishing/export?format=${format}`),
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
    update: (key: string, value: string) =>
      request<void>(`/settings/${key}`, { method: "PUT", body: { value } }),
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

interface Product {
  id: string;
  domain_id: string;
  category_id: string;
  name: string;
  niche: string;
  language: string;
  user_input?: Record<string, unknown>;
  batch_id?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  domain_name?: string;
  category_name?: string;
  platforms?: string[];
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
  status: string;
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
  status: string;
  platform_variants: PlatformVariantData[];
  social_variants: SocialVariantData[];
  posting_mode: string;
}

interface Asset {
  id: string;
  product_id: string;
  product_name?: string;
  asset_type: string;
  r2_key: string;
  cf_image_id?: string;
  url: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface Platform {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface PlatformFull {
  id: string;
  name: string;
  slug: string;
  title_max_chars: number | null;
  tag_count: number | null;
  tag_max_chars: number | null;
  audience: string;
  tone: string;
  seo_style: string;
  description_style: string;
  cta_style: string;
  forbidden_words: string;
  is_active: boolean;
}

interface SocialChannel {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface SocialChannelFull {
  id: string;
  name: string;
  slug: string;
  caption_max_chars: number | null;
  hashtag_count: number | null;
  tone: string;
  format: string;
  content_types: string[];
  is_active: boolean;
}

export type {
  Domain,
  Category,
  PromptTemplate,
  PromptVersion,
  AIModel,
  Product,
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
  ApiResponse,
};
