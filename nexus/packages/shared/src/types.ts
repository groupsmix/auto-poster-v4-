// ============================================================
// NEXUS Shared Types
// ============================================================

// --- Domain & Category ---

export interface Domain {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  domainId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

// --- Platform & Social ---

export interface Platform {
  id: string;
  name: string;
  slug: string;
  titleMaxChars?: number;
  tagCount?: number;
  tagMaxChars?: number;
  audience?: string;
  tone?: string;
  seoStyle?: string;
  descriptionStyle?: string;
  ctaStyle?: string;
  rulesJson?: Record<string, unknown>;
  isActive: boolean;
}

export interface SocialChannel {
  id: string;
  name: string;
  slug: string;
  captionMaxChars?: number;
  hashtagCount?: number;
  tone?: string;
  format?: string;
  contentTypes?: string[];
  isActive: boolean;
}

// --- Products ---

export interface Product {
  id: string;
  domainId: string;
  categoryId: string;
  name?: string;
  niche?: string;
  language: string;
  userInput?: Record<string, unknown>;
  batchId?: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt?: string;
}

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

// --- Workflow ---

export interface WorkflowRun {
  id: string;
  productId: string;
  batchId?: string;
  status: WorkflowStatus;
  startedAt?: string;
  completedAt?: string;
  currentStep?: string;
  totalSteps?: number;
  totalTokens: number;
  totalCost: number;
  cacheHits: number;
  error?: string;
}

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

export interface WorkflowStep {
  id: string;
  runId: string;
  stepName: string;
  stepOrder: number;
  status: string;
  aiUsed?: string;
  aiTried?: string[];
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  tokensUsed?: number;
  cost: number;
  cached: boolean;
  latencyMs?: number;
  startedAt?: string;
  completedAt?: string;
}

// --- Assets ---

export interface Asset {
  id: string;
  productId: string;
  assetType: "image" | "pdf" | "audio" | "mockup";
  r2Key: string;
  cfImageId?: string;
  url: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// --- Platform & Social Variants ---

export interface PlatformVariant {
  id: string;
  productId: string;
  platformId: string;
  title: string;
  description: string;
  tags?: string[];
  price?: number;
  metadata?: Record<string, unknown>;
  status: string;
  publishedAt?: string;
}

export interface SocialVariant {
  id: string;
  productId: string;
  channelId: string;
  content: Record<string, unknown>;
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
}

// --- Reviews ---

export interface Review {
  id: string;
  productId: string;
  runId: string;
  version: number;
  aiScore?: number;
  aiModel?: string;
  decision: "approved" | "rejected";
  feedback?: string;
  reviewedAt: string;
}

export interface RevisionHistory {
  id: string;
  productId: string;
  version: number;
  output: Record<string, unknown>;
  feedback?: string;
  aiScore?: number;
  aiModel?: string;
  reviewedAt?: string;
  decision: "approved" | "rejected";
}

// --- AI Models ---

export interface AIModel {
  id: string;
  name: string;
  provider?: string;
  taskType: AITaskType;
  rank: number;
  apiKeySecretName?: string;
  isWorkersAI: boolean;
  status: AIModelStatus;
  rateLimitResetAt?: string;
  dailyLimitResetAt?: string;
  isFreeTier: boolean;
  healthScore: number;
  totalCalls: number;
  totalFailures: number;
  avgLatencyMs: number;
  notes?: string;
}

export type AITaskType =
  | "writing"
  | "research"
  | "image"
  | "audio"
  | "seo"
  | "review"
  | "code"
  | "variation"
  | "social"
  | "humanizer";

export type AIModelStatus =
  | "active"
  | "sleeping"
  | "rate_limited"
  | "no_key";

// --- Analytics ---

export interface AnalyticsEvent {
  id: string;
  eventType: "workflow_complete" | "ai_call" | "cache_hit" | "failover" | "error";
  productId?: string;
  runId?: string;
  aiModel?: string;
  tokensUsed?: number;
  cost: number;
  latencyMs?: number;
  cached: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// --- Prompt Templates ---

export interface PromptTemplate {
  id: string;
  layer: PromptLayer;
  targetId?: string;
  name: string;
  prompt: string;
  version: number;
  isActive: boolean;
  updatedAt: string;
}

export type PromptLayer =
  | "master"
  | "role"
  | "domain"
  | "category"
  | "platform"
  | "social"
  | "review"
  | "context";

// --- Settings ---

export interface Setting {
  key: string;
  value: string;
  updatedAt: string;
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
