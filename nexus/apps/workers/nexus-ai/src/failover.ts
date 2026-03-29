// ============================================================
// Enhanced AI Failover Engine (V4) — The Core
// Flow: cache check -> failover chain -> Workers AI fallback
// Matches NEXUS-ARCHITECTURE-V4.md Part 5 exactly
// ============================================================

import { getModelsForTask } from "./registry";
import type { AIModelConfig } from "./registry";
import { checkCache, writeCache, recordCacheHit, recordCacheMiss } from "./cache";
import { callAIviaGateway, GatewayError } from "./gateway";
import { runTextGeneration, runImageGeneration } from "./workers-ai";
import {
  updateHealthScore,
  getOrInitHealth,
  markRateLimited,
  markSleeping,
  tryReactivate,
} from "./health";

/** Env bindings needed by the failover engine */
interface FailoverEnv {
  AI: {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
  };
  KV: KVNamespace;
  AI_GATEWAY_ACCOUNT_ID: string;
  AI_GATEWAY_ID: string;
  [key: string]: unknown; // dynamic API key lookups
}

/** Result returned by runWithFailover */
export interface FailoverResult {
  result: string;
  model: string;
  cached: boolean;
  tokens?: number;
  latencyMs?: number;
}

// ============================================================
// MAIN FAILOVER FUNCTION
// ============================================================

export async function runWithFailover(
  taskType: string,
  prompt: string,
  env: FailoverEnv
): Promise<FailoverResult> {
  // ---- Step 1: Check cache first ----
  const cached = await checkCache(prompt, taskType, env);
  if (cached) {
    recordCacheHit();
    return {
      result: cached.response,
      model: "cache",
      cached: true,
      tokens: cached.tokens,
    };
  }
  recordCacheMiss();

  // ---- Step 2: Get ordered model list for this task type ----
  const models = getModelsForTask(taskType);
  if (models.length === 0) {
    throw new Error(`No models registered for task type: ${taskType}`);
  }

  // ---- Step 3: Loop through models in failover order ----
  for (const model of models) {
    // Skip models without API key (unless Workers AI)
    if (!model.isWorkersAI) {
      const apiKey = env[model.apiKeyEnvName] as string | undefined;
      if (!apiKey) {
        console.log(`[SKIP] ${model.name} — no API key`);
        continue;
      }
    }

    // Check rate limit / sleeping status
    const healthState = getOrInitHealth(model.id, model.name);

    if (healthState.status === "rate_limited") {
      if (!tryReactivate(model.id, model.name)) {
        console.log(`[SLEEP] ${model.name} — rate limited`);
        continue;
      }
    }

    if (healthState.status === "sleeping") {
      if (!tryReactivate(model.id, model.name)) {
        console.log(`[SLEEP] ${model.name} — daily limit`);
        continue;
      }
    }

    // ---- Step 4: Try the call ----
    const start = Date.now();

    try {
      let result: string;
      let tokens: number | undefined;

      if (model.isWorkersAI) {
        // Workers AI — direct on-platform call
        const response = await callWorkersAIByType(model, prompt, env);
        result = response.text;
        tokens = response.tokens;
        console.log(`[WORKERS-AI] Fallback succeeded`);
      } else {
        // External provider — route through AI Gateway
        const apiKey = env[model.apiKeyEnvName] as string;
        const aiResult = await callAIviaGateway(model, apiKey, prompt, env);
        result = aiResult.text;
        tokens = aiResult.tokens;
      }

      const latencyMs = Date.now() - start;

      // Update health score on success
      updateHealthScore(model.id, model.name, true, latencyMs);

      console.log(
        `[OK] ${model.name} succeeded (${latencyMs}ms, health: ${getOrInitHealth(model.id, model.name).healthScore}%)`
      );

      // Cache the response
      await writeCache(prompt, taskType, result, env, model.name, tokens);

      return {
        result,
        model: model.name,
        cached: false,
        tokens,
        latencyMs,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const error = err instanceof Error ? err : new Error(String(err));
      const status =
        err instanceof GatewayError
          ? err.status
          : (err as { status?: number }).status;
      const code = (err as { code?: string }).code;

      // Update health score on failure
      updateHealthScore(model.id, model.name, false, latencyMs, error.message);

      if (status === 429) {
        markRateLimited(model.id, model.name);
      } else if (status === 402 || code === "QUOTA_EXCEEDED") {
        markSleeping(model.id, model.name);
      } else {
        console.log(
          `[ERR] ${model.name}: ${error.message} (health: ${getOrInitHealth(model.id, model.name).healthScore}%)`
        );
      }

      continue;
    }
  }

  // This should never happen for text tasks because Workers AI is always last
  throw new Error(`All AIs failed for task: ${taskType}`);
}

// ============================================================
// WORKERS AI DISPATCH — routes to correct Workers AI model
// ============================================================

async function callWorkersAIByType(
  model: AIModelConfig,
  prompt: string,
  env: FailoverEnv
): Promise<{ text: string; tokens?: number }> {
  // Text generation models (Llama 3.1)
  if (
    model.model === "@cf/meta/llama-3.1-8b-instruct" ||
    model.provider === "workers-ai"
  ) {
    // Check if this is an image model
    if (model.model === "@cf/stabilityai/stable-diffusion-xl-base-1.0") {
      const imageResult = await runImageGeneration(env, prompt);
      // For image tasks, return a placeholder text since result is binary
      return {
        text: `[Workers AI SDXL] Generated image (${imageResult.image.length} bytes)`,
      };
    }

    // Default to text generation
    const textResult = await runTextGeneration(env, prompt);
    return { text: textResult.text, tokens: textResult.tokens };
  }

  // Fallback — try text generation
  const textResult = await runTextGeneration(env, prompt);
  return { text: textResult.text, tokens: textResult.tokens };
}
