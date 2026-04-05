// ============================================================
// Image Generation Failover Engine
// Similar to text failover but handles binary image data
// Flow: ordered model list -> failover -> Workers AI SDXL fallback
// ============================================================

import type { Env } from "@nexus/shared";
import { getMidnightTimestamp, RATE_LIMIT_SLEEP_MS } from "@nexus/shared";
import { getModelsForTask } from "./registry";
import type { AIModelConfig } from "./registry";
import { callImageViaGateway } from "./gateway";
import { runImageGeneration } from "./workers-ai";
import { updateHealthScore } from "./health";

/** Result from image generation with failover */
export interface ImageGenerationResult {
  imageBase64: string;
  model: string;
  width: number;
  height: number;
}

/** In-memory model state for image models */
interface ImageModelState {
  status: "active" | "rate_limited" | "sleeping";
  rateLimitResetAt?: number;
  dailyLimitResetAt?: number;
}

const imageModelState: Map<string, ImageModelState> = new Map();

function getImageModelState(modelId: string): ImageModelState {
  let state = imageModelState.get(modelId);
  if (!state) {
    state = { status: "active" };
    imageModelState.set(modelId, state);
  }
  return state;
}

// ============================================================
// RUN IMAGE GENERATION WITH FAILOVER
// Tries models in order: Together.ai Flux Pro -> Dev -> Schnell -> Workers AI SDXL
// ============================================================

export async function runImageWithFailover(
  prompt: string,
  env: Env,
  options: { width?: number; height?: number; steps?: number } = {}
): Promise<ImageGenerationResult> {
  const taskType = "image_generation";
  const models = getModelsForTask(taskType);
  if (models.length === 0) {
    throw new Error("No models registered for image generation");
  }

  const width = options.width ?? 1024;
  const height = options.height ?? 1024;

  for (const model of models) {
    const state = getImageModelState(model.id);

    // Check API key (Workers AI doesn't need one)
    // Check env vars first, then KV (dashboard-managed keys)
    if (!model.isWorkersAI) {
      let apiKey = env[model.apiKeyEnvName] as string | undefined;
      if (!apiKey) {
        apiKey = await env.KV.get(`apikey:${model.apiKeyEnvName}`).catch(() => null) ?? undefined;
      }
      if (!apiKey) {
        console.log(`[IMG SKIP] ${model.name} -- no API key`);
        continue;
      }
    }

    // Check rate limit
    if (state.status === "rate_limited") {
      const now = Date.now();
      if (state.rateLimitResetAt && now < state.rateLimitResetAt) {
        console.log(`[IMG SLEEP] ${model.name} -- rate limited`);
        continue;
      }
      state.status = "active";
    }

    // Check daily limit
    if (state.status === "sleeping") {
      const now = Date.now();
      if (state.dailyLimitResetAt && now < state.dailyLimitResetAt) {
        console.log(`[IMG SLEEP] ${model.name} -- daily limit`);
        continue;
      }
      state.status = "active";
    }

    const start = Date.now();
    try {
      let imageBase64: string;
      let usedModel: string;

      if (model.isWorkersAI) {
        // Workers AI — direct on-platform call
        const result = await runImageGeneration(env, prompt, {
          steps: options.steps ?? 20,
          width,
          height,
        });
        // Convert Uint8Array to base64
        imageBase64 = uint8ArrayToBase64(result.image);
        usedModel = model.name;
        console.log(`[IMG WORKERS-AI] Fallback succeeded`);
      } else {
        // External AI — Together.ai via gateway
        // Read key from env first, then KV (same lookup order as above)
        let apiKey = env[model.apiKeyEnvName] as string | undefined;
        if (!apiKey) {
          apiKey = await env.KV.get(`apikey:${model.apiKeyEnvName}`).catch(() => null) ?? undefined;
        }
        const result = await callImageViaGateway(model, apiKey!, prompt, {
          width,
          height,
          steps: options.steps,
        });
        imageBase64 = result.imageBase64;
        usedModel = result.model;
      }

      const latency = Date.now() - start;
      await updateHealthScore(model.id, model.name, true, latency, env);
      console.log(`[IMG OK] ${model.name} succeeded (${latency}ms)`);

      return { imageBase64, model: usedModel, width, height };
    } catch (err: unknown) {
      const errorLatency = Date.now() - start;
      const error = err as { status?: number; code?: string; message?: string };
      const errorMsg = error.message ?? String(err);

      await updateHealthScore(model.id, model.name, false, errorLatency, env, errorMsg);

      if (error.status === 429) {
        state.status = "rate_limited";
        state.rateLimitResetAt = Date.now() + RATE_LIMIT_SLEEP_MS;
        console.log(`[IMG LIMIT] ${model.name} -> sleep 1hr`);
      } else if (error.status === 402 || error.code === "QUOTA_EXCEEDED") {
        state.status = "sleeping";
        state.dailyLimitResetAt = getMidnightTimestamp();
        console.log(`[IMG QUOTA] ${model.name} -> sleep until midnight`);
      } else {
        console.log(`[IMG ERR] ${model.name}: ${errorMsg}`);
      }

      continue;
    }
  }

  throw new Error("All image generation models failed. Check API keys and quotas.");
}

/** Convert Uint8Array to base64 string */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
