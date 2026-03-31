// ============================================================
// AI Model Registry — Ordered failover chains per task type
// Matches NEXUS-ARCHITECTURE-V4.md Part 6 exactly
// Every text-based chain ends with Workers AI as ultimate fallback
// ============================================================

import type { Env } from "@nexus/shared";

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

// --- Premium AI entries (dormant until API key is added) ---
// The failover engine automatically skips models without an API key.
// Just set the secret on nexus-ai worker → model activates instantly.

const CLAUDE_SONNET: AIModelConfig = {
  id: "claude-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic",
  apiKeyEnvName: "ANTHROPIC_API_KEY", isWorkersAI: false, isFree: false, model: "claude-3-5-sonnet-20241022",
};
const GPT4O: AIModelConfig = {
  id: "gpt-4o", name: "GPT-4o", provider: "openai",
  apiKeyEnvName: "OPENAI_API_KEY", isWorkersAI: false, isFree: false, model: "gpt-4o",
};
const GPT4O_MINI: AIModelConfig = {
  id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai",
  apiKeyEnvName: "OPENAI_API_KEY", isWorkersAI: false, isFree: false, model: "gpt-4o-mini",
};
const GEMINI_PRO: AIModelConfig = {
  id: "gemini-pro", name: "Gemini 2.0 Pro", provider: "google",
  apiKeyEnvName: "GOOGLE_API_KEY", isWorkersAI: false, isFree: false, model: "gemini-2.0-pro",
};
const GEMINI_FLASH: AIModelConfig = {
  id: "gemini-flash", name: "Gemini 2.0 Flash", provider: "google",
  apiKeyEnvName: "GOOGLE_API_KEY", isWorkersAI: false, isFree: false, model: "gemini-2.0-flash",
};
const PERPLEXITY_SONAR: AIModelConfig = {
  id: "perplexity-sonar", name: "Perplexity Sonar", provider: "perplexity",
  apiKeyEnvName: "PERPLEXITY_API_KEY", isWorkersAI: false, isFree: false, model: "sonar-pro",
};

// ============================================================
// TASK_MODEL_REGISTRY — The master registry
// ============================================================

export const TASK_MODEL_REGISTRY: Record<string, AIModelConfig[]> = {
  // ----------------------------------------------------------
  // RESEARCH TASKS
  // ----------------------------------------------------------
  research: [
    // Premium (dormant until key added)
    PERPLEXITY_SONAR,
    GPT4O,
    GEMINI_PRO,
    // Free tier
    { id: "tavily", name: "Tavily Search", provider: "tavily", apiKeyEnvName: "TAVILY_API_KEY", isWorkersAI: false, isFree: true },
    { id: "exa", name: "Exa Neural Search", provider: "exa", apiKeyEnvName: "EXA_API_KEY", isWorkersAI: false, isFree: true },
    { id: "serpapi", name: "SerpAPI", provider: "serpapi", apiKeyEnvName: "SERPAPI_KEY", isWorkersAI: false, isFree: true },
    { id: "deepseek-v3", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    WORKERS_AI_TEXT,
  ],

  seo: [
    // Premium (dormant until key added)
    GPT4O,
    GEMINI_PRO,
    // Free tier
    { id: "dataforseo", name: "DataForSEO", provider: "dataforseo", apiKeyEnvName: "DATAFORSEO_KEY", isWorkersAI: false, isFree: true },
    { id: "serpapi-seo", name: "SerpAPI", provider: "serpapi", apiKeyEnvName: "SERPAPI_KEY", isWorkersAI: false, isFree: true },
    { id: "qwen-flash", name: "Qwen 3.5 Flash", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-7B-Instruct" },
    WORKERS_AI_TEXT,
  ],

  // ----------------------------------------------------------
  // WRITING & CONTENT TASKS
  // ----------------------------------------------------------
  writing: [
    // Premium (dormant until key added) — Claude excels at nuanced, creative writing
    CLAUDE_SONNET,
    GPT4O,
    // Free tier
    { id: "deepseek-v3-write", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "qwen-max", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    { id: "doubao-pro", name: "Doubao 1.5 Pro", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-pro" },
    { id: "kimi-k15", name: "Kimi k1.5", provider: "moonshot", apiKeyEnvName: "MOONSHOT_API_KEY", isWorkersAI: false, isFree: true, model: "moonshot-v1-8k" },
    WORKERS_AI_TEXT,
  ],

  copywriting: [
    // Premium (dormant until key added)
    CLAUDE_SONNET,
    GPT4O_MINI,
    // Free tier
    { id: "deepseek-v3-copy", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "doubao-pro-copy", name: "Doubao 1.5 Pro", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-pro" },
    { id: "qwen-max-copy", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    WORKERS_AI_TEXT,
  ],

  // ----------------------------------------------------------
  // PLATFORM & SOCIAL TASKS
  // ----------------------------------------------------------
  platform_variation: [
    // Premium (dormant until key added)
    GPT4O_MINI,
    GEMINI_FLASH,
    // Free tier
    { id: "qwen-flash-var", name: "Qwen 3.5 Flash", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-7B-Instruct" },
    { id: "deepseek-v3-var", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "doubao-lite", name: "Doubao 1.5 Lite", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-lite" },
    WORKERS_AI_TEXT,
  ],

  social_adaptation: [
    // Premium (dormant until key added) — Claude excels at tone/voice adaptation
    CLAUDE_SONNET,
    GPT4O_MINI,
    // Free tier
    { id: "doubao-pro-social", name: "Doubao 1.5 Pro", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-pro" },
    { id: "deepseek-v3-social", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "qwen-max-social", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    WORKERS_AI_TEXT,
  ],

  humanizer: [
    // Premium (dormant until key added) — Claude is best at natural-sounding text
    CLAUDE_SONNET,
    // Free tier
    { id: "doubao-pro-human", name: "Doubao 1.5 Pro", provider: "doubao", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "ByteDance/Doubao-1.5-pro" },
    { id: "deepseek-v3-human", name: "DeepSeek-V3", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-chat" },
    { id: "minimax-m25", name: "MiniMax M2.5", provider: "minimax", apiKeyEnvName: "MINIMAX_API_KEY", isWorkersAI: false, isFree: true },
    WORKERS_AI_TEXT,
  ],

  quality_review: [
    // Premium (dormant until key added) — Claude & GPT-4o are best at critical analysis
    CLAUDE_SONNET,
    GPT4O,
    // Free tier
    { id: "deepseek-r1-review", name: "DeepSeek-R1", provider: "deepseek", apiKeyEnvName: "DEEPSEEK_API_KEY", isWorkersAI: false, isFree: true, model: "deepseek-reasoner" },
    { id: "qwen-max-review", name: "Qwen 3.5 Max", provider: "qwen", apiKeyEnvName: "SILICONFLOW_API_KEY", isWorkersAI: false, isFree: true, model: "Qwen/Qwen2.5-72B-Instruct" },
    WORKERS_AI_TEXT,
  ],

  // ----------------------------------------------------------
  // REASONING TASKS (used by AI CEO for deep niche analysis)
  // ----------------------------------------------------------
  reasoning: [
    // Premium (dormant until key added) — GPT-4o & Claude excel at deep analysis
    GPT4O,
    CLAUDE_SONNET,
    // Free tier
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
TASK_MODEL_REGISTRY.seo_formatting = TASK_MODEL_REGISTRY.seo;

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

// ============================================================
// KV PERSISTENCE — Survive worker restarts
// ============================================================

/** KV key for persisted registry reorders */
const REGISTRY_KV_KEY = "registry:reorders";

/** Track which task types have been loaded from KV */
let _kvLoaded = false;

/**
 * Persist a registry reorder to KV so it survives worker restarts.
 * Stores only the ordered model IDs per task type (not the full config).
 */
export async function persistRegistryReorder(
  taskType: string,
  modelIds: string[],
  env: Env
): Promise<void> {
  try {
    const existing = await env.KV.get<Record<string, string[]>>(REGISTRY_KV_KEY, "json").catch(() => null);
    const reorders = existing ?? {};
    reorders[taskType] = modelIds;
    await env.KV.put(REGISTRY_KV_KEY, JSON.stringify(reorders));
    console.log(`[REGISTRY] Persisted reorder for ${taskType} to KV`);
  } catch {
    console.log(`[REGISTRY] Could not persist reorder for ${taskType}`);
  }
}

/**
 * Load persisted registry reorders from KV on startup.
 * Falls back to hardcoded defaults if KV has no data.
 * Only runs once per worker instance.
 */
export async function loadPersistedReorders(env: Env): Promise<void> {
  if (_kvLoaded) return;
  _kvLoaded = true;

  try {
    const reorders = await env.KV.get<Record<string, string[]>>(REGISTRY_KV_KEY, "json").catch(() => null);
    if (!reorders) return;

    for (const [taskType, modelIds] of Object.entries(reorders)) {
      const currentModels = TASK_MODEL_REGISTRY[taskType];
      if (!currentModels) continue;

      // Rebuild the ordered list using persisted IDs, keeping full config objects
      const reordered: AIModelConfig[] = [];
      for (const id of modelIds) {
        const model = currentModels.find((m) => m.id === id);
        if (model) reordered.push(model);
      }
      // Append any new models that weren't in the persisted order
      for (const model of currentModels) {
        if (!modelIds.includes(model.id)) {
          reordered.push(model);
        }
      }

      if (reordered.length > 0) {
        TASK_MODEL_REGISTRY[taskType] = reordered;
        console.log(`[REGISTRY] Restored reorder for ${taskType} from KV`);
      }
    }
  } catch {
    console.log(`[REGISTRY] Could not load persisted reorders from KV`);
  }
}
