// ============================================================
// Enhanced AI Failover Engine (V4) — THE CORE
// Flow: cache check -> ordered model list -> failover -> Workers AI fallback
// Every text-based chain ends with Workers AI — you NEVER get "All AIs failed"
// ============================================================

import type { Env } from "@nexus/shared";
import { getMidnightTimestamp, RATE_LIMIT_SLEEP_MS } from "@nexus/shared";
import { checkCache, writeCache } from "./cache";
import { callAIviaGateway } from "./gateway";
import { updateHealthScore } from "./health";
import { getModelsForTask } from "./registry";
import type { AIModelConfig } from "./registry";
import { runTextGeneration } from "./workers-ai";

/** Runtime model state — tracks rate limits and sleep status per model */
interface ModelRuntimeState {
  status: "active" | "rate_limited" | "sleeping";
  rateLimitResetAt?: number;
  dailyLimitResetAt?: number;
}

/** In-memory runtime state for models — keyed by model ID */
const modelState: Map<string, ModelRuntimeState> = new Map();

/** KV key prefix for persisted model state */
const MODEL_STATE_KV_PREFIX = "model_state:";
/** TTL for persisted model state in KV (24 hours — ensures rate-limit state survives restarts) */
const MODEL_STATE_KV_TTL = 86400;

/** Get or create runtime state for a model, restoring from KV if available */
async function getModelState(modelId: string, env: Env): Promise<ModelRuntimeState> {
  let state = modelState.get(modelId);
  if (!state) {
    // Try to restore from KV (survives worker restarts)
    const persisted = await env.KV.get<ModelRuntimeState>(
      `${MODEL_STATE_KV_PREFIX}${modelId}`,
      "json"
    ).catch(() => null);
    if (persisted) {
      state = persisted;
      console.log(`[STATE] Restored ${modelId} from KV: ${state.status}`);
    } else {
      state = { status: "active" };
    }
    modelState.set(modelId, state);
  }
  return state;
}

/** Persist model state to KV so it survives worker restarts */
async function persistModelState(modelId: string, state: ModelRuntimeState, env: Env): Promise<void> {
  await env.KV.put(
    `${MODEL_STATE_KV_PREFIX}${modelId}`,
    JSON.stringify(state),
    { expirationTtl: MODEL_STATE_KV_TTL }
  ).catch(() => {
    console.log(`[STATE] Could not persist state for ${modelId}`);
  });
}

// ============================================================
// RUN WITH FAILOVER — the main function
// Returns { result, model, cached, tokens? }
// ============================================================

export async function runWithFailover(
  taskType: string,
  prompt: string,
  env: Env,
  preferredProvider?: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  // ── Step 1: Check cache first ──────────────────────────────
  const cached = await checkCache(prompt, taskType, env);
  if (cached) {
    return {
      result: cached.response,
      model: "cache",
      cached: true,
      tokens: cached.tokens,
    };
  }

  // ── Step 2: Get ordered model list from registry ───────────
  let models = getModelsForTask(taskType);
  if (models.length === 0) {
    throw new Error(`No models registered for task type: ${taskType}`);
  }

  // ── Step 2.5: Re-prioritize models if CEO config specifies a preferred provider ──
  if (preferredProvider) {
    const preferred: AIModelConfig[] = [];
    const rest: AIModelConfig[] = [];
    for (const m of models) {
      if (m.provider === preferredProvider || m.id.includes(preferredProvider)) {
        preferred.push(m);
      } else {
        rest.push(m);
      }
    }
    if (preferred.length > 0) {
      models = [...preferred, ...rest];
      console.log(`[FAILOVER] CEO preferred provider "${preferredProvider}" — reordered: [${models.map(m => m.name).join(", ")}]`);
    }
  }

  // ── Step 3: Loop through models in order ───────────────────
  for (const model of models) {
    const state = await getModelState(model.id, env);

    // (a) Check API key (Workers AI doesn't need one)
    if (!model.isWorkersAI) {
      const apiKey = env[model.apiKeyEnvName] as string | undefined;
      if (!apiKey) {
        console.log(`[SKIP] ${model.name} -- no API key`);
        continue;
      }
    }

    // (b) Check rate limit status
    if (state.status === "rate_limited") {
      const now = Date.now();
      if (state.rateLimitResetAt && now < state.rateLimitResetAt) {
        console.log(`[SLEEP] ${model.name} -- rate limited`);
        continue;
      }
      // Reset time passed — reactivate
      state.status = "active";
      console.log(`[REACTIVATE] ${model.name} -- rate limit expired`);
    }

    // (c) Check daily limit (sleeping) status
    if (state.status === "sleeping") {
      const now = Date.now();
      if (state.dailyLimitResetAt && now < state.dailyLimitResetAt) {
        console.log(`[SLEEP] ${model.name} -- daily limit`);
        continue;
      }
      // Midnight passed — reactivate
      state.status = "active";
      console.log(`[REACTIVATE] ${model.name} -- daily limit reset`);
    }

    // (d) Try the call
    const start = Date.now();
    try {
      let result: string;
      let tokens: number | undefined;

      if (model.isWorkersAI) {
        // Workers AI — direct on-platform call, no external dependency
        const aiResult = await runTextGeneration(
          env,
          prompt
        );
        result = aiResult.text;
        tokens = aiResult.tokens;
        console.log(`[WORKERS-AI] Fallback succeeded`);
      } else {
        // External AI — route through AI Gateway
        const apiKey = env[model.apiKeyEnvName] as string;
        const aiResult = await callAIviaGateway(model, apiKey, prompt, env);
        result = aiResult.text;
        tokens = aiResult.tokens;
      }

      // (e) On success: update health, write cache, log, return
      const latency = Date.now() - start;
      await updateHealthScore(model.id, model.name, true, latency, env);
      await writeCache(prompt, taskType, result, model.name, tokens, env);

      console.log(
        `[OK] ${model.name} succeeded (${latency}ms)`
      );

      return { result, model: model.name, cached: false, tokens };
    } catch (err: unknown) {
      // (f) On error: handle specific error types
      const errorLatency = Date.now() - start;
      const error = err as { status?: number; code?: string; message?: string };
      const errorMsg = error.message ?? String(err);

      await updateHealthScore(model.id, model.name, false, errorLatency, env, errorMsg);

      if (error.status === 429) {
        // Rate limited — sleep for 1 hour
        state.status = "rate_limited";
        state.rateLimitResetAt = Date.now() + RATE_LIMIT_SLEEP_MS;
        await persistModelState(model.id, state, env);
        console.log(`[LIMIT] ${model.name} -> sleep 1hr`);
      } else if (
        error.status === 402 ||
        error.code === "QUOTA_EXCEEDED"
      ) {
        // Quota exceeded — sleep until midnight
        state.status = "sleeping";
        state.dailyLimitResetAt = getMidnightTimestamp();
        await persistModelState(model.id, state, env);
        console.log(`[QUOTA] ${model.name} -> sleep until midnight`);
      } else {
        console.log(`[ERR] ${model.name}: ${errorMsg}`);
      }

      continue;
    }
  }

  // V4: All models failed including Workers AI — return structured error
  const failedModels = models.map((m) => {
    const state = modelState.get(m.id);
    return {
      name: m.name,
      status: state?.status ?? "unknown",
      isWorkersAI: m.isWorkersAI,
    };
  });

  const error = new Error(`All AIs failed for task: ${taskType}`);
  (error as unknown as Record<string, unknown>).details = {
    taskType,
    failedModels,
    suggestion: "Check API keys, rate limits, and Workers AI neuron quota. Retry after a few minutes.",
  };
  throw error;
}

// ============================================================
// GET MODEL RUNTIME STATES — for debugging/admin
// ============================================================

export async function getModelStates(env: Env): Promise<Record<string, ModelRuntimeState>> {
  // List all known model state keys from KV to include persisted state
  const kvList = await env.KV.list({ prefix: MODEL_STATE_KV_PREFIX }).catch(() => ({ keys: [] }));
  for (const key of kvList.keys) {
    const modelId = key.name.slice(MODEL_STATE_KV_PREFIX.length);
    if (!modelState.has(modelId)) {
      await getModelState(modelId, env);
    }
  }
  const result: Record<string, ModelRuntimeState> = {};
  for (const [id, state] of modelState) {
    result[id] = { ...state };
  }
  return result;
}
