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
const KV_MODEL_STATE_PREFIX = "model-state:";

/** TTL for persisted model state in KV (2 hours) */
const KV_MODEL_STATE_TTL = 7200;

/** Get or create runtime state for a model, hydrating from KV if needed */
async function getModelState(modelId: string, env: Env): Promise<ModelRuntimeState> {
  let state = modelState.get(modelId);
  if (!state) {
    // Try to hydrate from KV (survives worker restarts)
    try {
      const persisted = await env.KV.get<ModelRuntimeState>(
        `${KV_MODEL_STATE_PREFIX}${modelId}`,
        "json"
      );
      if (persisted) {
        state = persisted;
        modelState.set(modelId, state);
        return state;
      }
    } catch {
      // KV read failed — fall through to default
    }
    state = { status: "active" };
    modelState.set(modelId, state);
  }
  return state;
}

/** Persist model state to KV so it survives worker restarts */
async function persistModelState(modelId: string, state: ModelRuntimeState, env: Env): Promise<void> {
  try {
    await env.KV.put(
      `${KV_MODEL_STATE_PREFIX}${modelId}`,
      JSON.stringify(state),
      { expirationTtl: KV_MODEL_STATE_TTL }
    );
  } catch {
    // Best-effort persistence — don't break the request
    console.log(`[FAILOVER] Could not persist state for ${modelId}`);
  }
}

// ============================================================
// RUN WITH FAILOVER — the main function
// Returns { result, model, cached, tokens? }
// ============================================================

export async function runWithFailover(
  taskType: string,
  prompt: string,
  env: Env
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
  const models = getModelsForTask(taskType);
  if (models.length === 0) {
    throw new Error(`No models registered for task type: ${taskType}`);
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

  // V4: This should never happen for text tasks because Workers AI is always last
  throw new Error(`All AIs failed for task: ${taskType}`);
}

// ============================================================
// GET MODEL RUNTIME STATES — for debugging/admin
// ============================================================

export function getModelStates(): Record<string, ModelRuntimeState> {
  const result: Record<string, ModelRuntimeState> = {};
  for (const [id, state] of modelState) {
    result[id] = { ...state };
  }
  return result;
}
