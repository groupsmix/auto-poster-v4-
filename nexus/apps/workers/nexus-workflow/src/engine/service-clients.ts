// ============================================================
// Workflow Engine — Service client helpers
// Shared helpers for calling nexus-ai, nexus-variation,
// nexus-storage, and Workers AI bindings.
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";
import { generateId, now, parseAIJSON, AI_COST_PER_1K_TOKENS } from "@nexus/shared";

// --- Helper: generate actual images via Workers AI and store in R2 ---

export async function generateAndStoreImages(
  env: Env,
  productId: string,
  imagePrompts: Array<{ description: string; style?: string; dimensions?: { width: number; height: number } }>
): Promise<Array<{ asset_id: string; r2_key: string; url: string }>> {
  const results: Array<{ asset_id: string; r2_key: string; url: string }> = [];

  for (const prompt of imagePrompts.slice(0, 3)) {
    try {
      // Call Workers AI Stable Diffusion XL via the AI binding
      const imageResult = (await env.AI.run(
        "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        {
          prompt: prompt.description,
          num_steps: 20,
          width: prompt.dimensions?.width ?? 1024,
          height: prompt.dimensions?.height ?? 1024,
        }
      )) as ReadableStream | ArrayBuffer | Uint8Array;

      // Convert to Uint8Array
      let imageBytes: Uint8Array;
      if (imageResult instanceof Uint8Array) {
        imageBytes = imageResult;
      } else if (imageResult instanceof ArrayBuffer) {
        imageBytes = new Uint8Array(imageResult);
      } else {
        // ReadableStream — collect chunks
        const reader = (imageResult as ReadableStream).getReader();
        const chunks: Uint8Array[] = [];
        let done = false;
        while (!done) {
          const read = await reader.read();
          done = read.done;
          if (read.value) chunks.push(read.value as Uint8Array);
        }
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        imageBytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          imageBytes.set(chunk, offset);
          offset += chunk.length;
        }
      }

      // Convert to base64 for R2 upload via nexus-storage
      const base64 = btoa(String.fromCharCode(...imageBytes));
      const r2Key = `products/${productId}/images/${generateId()}.png`;

      // Upload to R2 via nexus-storage
      const uploadResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/r2/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: r2Key, data: base64, contentType: "image/png" }),
      });
      const uploadJson = (await uploadResp.json()) as ApiResponse;
      if (!uploadJson.success) {
        console.error(`[IMAGE] R2 upload failed for ${r2Key}: ${uploadJson.error}`);
        continue;
      }

      // Create asset record in D1
      const assetId = generateId();
      const assetUrl = `/r2/${encodeURIComponent(r2Key)}`;
      await storageQuery(
        env,
        `INSERT INTO assets (id, product_id, asset_type, r2_key, url, metadata, created_at)
         VALUES (?, ?, 'image', ?, ?, ?, ?)`,
        [
          assetId,
          productId,
          r2Key,
          assetUrl,
          JSON.stringify({ prompt: prompt.description, style: prompt.style }),
          now(),
        ]
      );

      results.push({ asset_id: assetId, r2_key: r2Key, url: assetUrl });
      console.log(`[IMAGE] Generated and stored image: ${r2Key}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[IMAGE] Failed to generate image: ${message}`);
    }
  }

  return results;
}

// --- Helper: call nexus-ai service binding ---

export async function callAI(
  env: Env,
  taskType: string,
  prompt: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType, prompt }),
  });

  const json = (await response.json()) as ApiResponse<{
    result: string;
    model: string;
    cached: boolean;
    tokens?: number;
  }>;

  if (!json.success || !json.data) {
    throw new Error(`AI call failed: ${json.error ?? "Unknown error"}`);
  }

  return json.data;
}

// --- Helper: call nexus-variation service binding ---

export async function callVariation(
  env: Env,
  taskType: string,
  prompt: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_VARIATION.fetch(
    "http://nexus-variation/variation/run",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskType, prompt }),
    }
  );

  const json = (await response.json()) as ApiResponse<{
    result: string;
    model: string;
    cached: boolean;
    tokens?: number;
  }>;

  if (!json.success || !json.data) {
    throw new Error(`Variation call failed: ${json.error ?? "Unknown error"}`);
  }

  return json.data;
}

// --- Helper: call nexus-storage D1 queries ---

export async function storageQuery<T = unknown>(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const response = await env.NEXUS_STORAGE.fetch(
    "http://nexus-storage/d1/query",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }
  );

  const json = (await response.json()) as ApiResponse;
  if (!json.success) {
    throw new Error(`Storage query failed: ${json.error ?? "Unknown error"}`);
  }
  return json.data as T;
}

// --- Helper: update workflow run in D1 ---

type AllowedRunColumn =
  | "status"
  | "current_step"
  | "total_tokens"
  | "total_cost"
  | "cache_hits"
  | "completed_at"
  | "error";

const ALLOWED_RUN_COLUMNS: ReadonlySet<string> = new Set<AllowedRunColumn>([
  "status",
  "current_step",
  "total_tokens",
  "total_cost",
  "cache_hits",
  "completed_at",
  "error",
]);

export async function updateWorkflowRun(
  env: Env,
  runId: string,
  fields: Partial<Record<AllowedRunColumn, unknown>>
): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_RUN_COLUMNS.has(key)) continue;
    setClauses.push(`"${key}" = ?`);
    values.push(value);
  }

  if (setClauses.length === 0) return;

  values.push(runId);

  await storageQuery(
    env,
    `UPDATE workflow_runs SET ${setClauses.join(", ")} WHERE id = ?`,
    values
  );
}

// --- Helper: parse AI response as JSON ---

// parseAIResponse delegates to the shared parseAIJSON (single source of truth)
export const parseAIResponse = parseAIJSON;

/** Step-level timeout in milliseconds (5 minutes per step) */
export const STEP_TIMEOUT_MS = 5 * 60 * 1000;
/** Maximum retries per step */
export const STEP_MAX_RETRIES = 1;

/**
 * Estimate token cost for quota tracking.
 * Even free-tier models have implicit costs (rate limits, quota usage).
 * Cost rates are defined in @nexus/shared AI_COST_PER_1K_TOKENS — update there
 * when provider pricing changes.
 */
export function estimateTokenCost(model: string | undefined, tokens: number): number {
  if (!model || tokens === 0) return 0;
  const provider = model.split("/")[0] ?? model;
  const rate = AI_COST_PER_1K_TOKENS[provider] ?? 0;
  return (tokens / 1000) * rate;
}

/**
 * Execute a promise with a timeout.
 * Rejects with a timeout error if the promise doesn't resolve within the limit.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}
