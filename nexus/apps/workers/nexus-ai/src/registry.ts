// ============================================================
// AI Model Registry — Ordered failover chains per task type
// Matches NEXUS-ARCHITECTURE-V4.md Part 6 exactly
// Every text-based chain ends with Workers AI as ultimate fallback
// ============================================================

export interface AIModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKeyEnvName: string;
  isWorkersAI: boolean;
  isFree: boolean;
  model?: string; // provider-specific model identifier
}

// --- Workers AI fallback entries (reused across chains) ---

const WORKERS_AI_TEXT: AIModelConfig = {
  id: "workers-ai-llama",
  name: "Workers AI (Llama 3.1)",
  provider: "workers-ai",
  apiKeyEnvName: "",
  isWorkersAI: true,
  isFree: true,
  model: "@cf/meta/llama-3.1-8b-instruct",
};

// ============================================================
// TASK_MODEL_REGISTRY — The master registry
// ============================================================

export const TASK_MODEL_REGISTRY: Record<string, AIModelConfig[]> = {
  // ----------------------------------------------------------
  // RESEARCH TASKS
  // ----------------------------------------------------------
  research: [
    { id: "tavily", name: "Tavily Search", provider: "tavily", apiKeyEnvName: "TAVILY_API_KEY", isWorkersAI: false, isFree: true },
    { id: "exa", name: "Exa Neural Search", provider: "exa", apiKeyEnvName: "EXA_API_KEY", isWorkersAI: false, isFree: true },
    { id: "serpapi", name: "SerpAPI", provider: "serpapi", apiKeyEnvName: "SERPAPI_KEY", isWorkersAI: false, isFree: true },
    { id: "deepseek-v3", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    WORKERS_AI_TEXT,
  ],

  seo: [
    { id: "dataforseo", name: "DataForSEO", provider: "dataforseo", apiKeyEnvName: "DATAFORSEO_KEY", isWorkersAI: false, isFree: true },
    { id: "serpapi-seo", name: "SerpAPI", provider: "serpapi", apiKeyEnvName: "SERPAPI_KEY", isWorkersAI: false, isFree: true },
    { id: "qwen-flash", name: "Qwen 3.5 Flash", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-7B-Instruct" },
    WORKERS_AI_TEXT,
  ],

  // ----------------------------------------------------------
  // WRITING & CONTENT TASKS
  // ----------------------------------------------------------
  writing: [
    { id: "deepseek-v3-write", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "qwen-max", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    { id: "doubao-pro", name: "Doubao 1.5 Pro", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-pro" },
    { id: "kimi-k15", name: "Kimi k1.5", provider: "moonshot", apiKeyEnvName: "MOONSHOT_API_KEY", isWorkersAI: false, isFree: true, model: "moonshot-v1-8k" },
    WORKERS_AI_TEXT,
  ],

  copywriting: [
    { id: "deepseek-v3-copy", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "doubao-pro-copy", name: "Doubao 1.5 Pro", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-pro" },
    { id: "qwen-max-copy", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    WORKERS_AI_TEXT,
  ],

  // ----------------------------------------------------------
  // PLATFORM & SOCIAL TASKS
  // ----------------------------------------------------------
  platform_variation: [
    { id: "qwen-flash-var", name: "Qwen 3.5 Flash", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-7B-Instruct" },
    { id: "deepseek-v3-var", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "doubao-lite", name: "Doubao 1.5 Lite", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-lite" },
    WORKERS_AI_TEXT,
  ],

  social_adaptation: [
    { id: "doubao-pro-social", name: "Doubao 1.5 Pro", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-pro" },
    { id: "deepseek-v3-social", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "qwen-max-social", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    WORKERS_AI_TEXT,
  ],

  humanizer: [
    { id: "doubao-pro-human", name: "Doubao 1.5 Pro", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-pro" },
    { id: "deepseek-v3-human", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "minimax-m25", name: "MiniMax M2.5", provider: "minimax", apiKeyEnvName: "MINIMAX_API_KEY", isWorkersAI: false, isFree: true },
    WORKERS_AI_TEXT,
  ],

  quality_review: [
    { id: "deepseek-r1-review", name: "DeepSeek-R1", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-reasoner" },
    { id: "qwen-max-review", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    WORKERS_AI_TEXT,
  ],

  // ----------------------------------------------------------
  // REASONING TASKS (used by AI CEO for deep niche analysis)
  // ----------------------------------------------------------
  reasoning: [
    { id: "deepseek-r1-reason", name: "DeepSeek-R1", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-reasoner" },
    { id: "deepseek-v3-reason", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "qwen-max-reason", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    WORKERS_AI_TEXT,
  ],
};

// --- Aliases: workflow steps use short TaskType names that must resolve here ---
TASK_MODEL_REGISTRY.image = TASK_MODEL_REGISTRY.copywriting;
TASK_MODEL_REGISTRY.review = TASK_MODEL_REGISTRY.quality_review;
TASK_MODEL_REGISTRY.variation = TASK_MODEL_REGISTRY.platform_variation;
TASK_MODEL_REGISTRY.social = TASK_MODEL_REGISTRY.social_adaptation;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/** Get the ordered failover chain for a task type */
export function getModelsForTask(taskType: string): AIModelConfig[] {
  return TASK_MODEL_REGISTRY[taskType] ?? [];
}

/** Find a specific model by ID across all registries */
export function getModelById(modelId: string): AIModelConfig | null {
  for (const models of Object.values(TASK_MODEL_REGISTRY)) {
    const found = models.find((m) => m.id === modelId);
    if (found) return found;
  }
  return null;
}

/** Get all unique task types */
export function getTaskTypes(): string[] {
  return Object.keys(TASK_MODEL_REGISTRY);
}

/** Get all unique model IDs */
export function getAllModelIds(): string[] {
  const ids = new Set<string>();
  for (const models of Object.values(TASK_MODEL_REGISTRY)) {
    for (const model of models) {
      ids.add(model.id);
    }
  }
  return Array.from(ids);
}
