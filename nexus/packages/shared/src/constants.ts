// ============================================================
// NEXUS Shared Constants
// ============================================================

/** AI response cache TTLs by task type (in seconds) */
export const CACHE_TTL: Record<string, number> = {
  research: 3600, // 1 hour
  writing: 86400, // 24 hours
  seo: 21600, // 6 hours
  code: 86400, // 24 hours
  variation: 86400, // 24 hours
  social: 86400, // 24 hours
  review: 0, // never cache
  image: 0, // never cache
  audio: 0, // never cache
};

/** Workflow step names in execution order */
export const WORKFLOW_STEPS = [
  "research",
  "strategy",
  "content_generation",
  "seo_optimization",
  "image_generation",
  "platform_variants",
  "social_content",
  "humanizer_pass",
  "quality_review",
] as const;

/** Default settings values */
export const DEFAULT_SETTINGS: Record<string, string> = {
  social_posting_mode: "manual",
  default_language: "en",
  ceo_review_required: "true",
  auto_publish_after_approval: "false",
  batch_max_products: "10",
  cache_enabled: "true",
  ai_gateway_enabled: "true",
};

/** All supported product statuses */
export const PRODUCT_STATUSES = [
  "draft",
  "queued",
  "running",
  "pending_review",
  "approved",
  "rejected",
  "in_revision",
  "published",
  "cancelled",
] as const;

/** Workers AI model identifiers */
export const WORKERS_AI_MODELS = {
  text: "@cf/meta/llama-3.1-8b-instruct",
  image: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  speech: "@cf/openai/whisper",
} as const;
