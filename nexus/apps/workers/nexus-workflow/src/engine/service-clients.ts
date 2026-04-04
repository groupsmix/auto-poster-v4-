// ============================================================
// Workflow Engine — Service client helpers
// Shared helpers for calling nexus-ai, nexus-variation,
// nexus-storage, and Workers AI bindings.
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";
import { generateId, now, parseAIJSON, AI_COST_PER_1K_TOKENS } from "@nexus/shared";

// ============================================================
// Platform-specific image dimensions for each target platform
// ============================================================

export const PLATFORM_IMAGE_SPECS: Record<string, { width: number; height: number; label: string; style: string }> = {
  etsy: { width: 1024, height: 1024, label: "Etsy Thumbnail", style: "Clean product mockup on lifestyle background, warm lighting, professional product photography style" },
  pinterest: { width: 1024, height: 1536, label: "Pinterest Pin", style: "Tall vertical composition, bold text overlay area at top, eye-catching colors, lifestyle context" },
  instagram: { width: 1024, height: 1024, label: "Instagram Post", style: "Square lifestyle photo, trendy aesthetic, muted tones with pops of color, aspirational mood" },
  twitter: { width: 1536, height: 864, label: "Twitter/X Card", style: "Wide landscape, bold composition, high contrast, clear subject visible at small size" },
  facebook: { width: 1200, height: 628, label: "Facebook Post", style: "Landscape layout, warm and inviting, lifestyle context, clear product visibility" },
  gumroad: { width: 1280, height: 720, label: "Gumroad Hero", style: "Wide banner, modern and clean, gradient background, product mockup front and center" },
  shopify: { width: 1024, height: 1024, label: "Shopify Product", style: "Clean white or minimal background, professional product photography, well-lit" },
  thumbnail: { width: 512, height: 512, label: "Universal Thumbnail", style: "High contrast, readable at 150x150px, clear subject, bold colors" },
};

// --- Helper: generate actual images via AI failover and store in R2 ---

export async function generateAndStoreImages(
  env: Env,
  productId: string,
  imagePrompts: Array<{
    description: string;
    style?: string;
    platform?: string;
    dimensions?: { width: number; height: number };
  }>
): Promise<Array<{ asset_id: string; r2_key: string; url: string; platform: string; model: string }>> {
  const results: Array<{ asset_id: string; r2_key: string; url: string; platform: string; model: string }> = [];

  for (const prompt of imagePrompts.slice(0, 8)) {
    try {
      const platform = prompt.platform ?? "thumbnail";
      const spec = PLATFORM_IMAGE_SPECS[platform];
      const width = prompt.dimensions?.width ?? spec?.width ?? 1024;
      const height = prompt.dimensions?.height ?? spec?.height ?? 1024;

      // Enhance prompt with platform-specific style
      const styleHint = prompt.style ?? spec?.style ?? "";
      const enhancedPrompt = styleHint
        ? `${prompt.description}. Style: ${styleHint}`
        : prompt.description;

      // Call nexus-ai image generation endpoint (uses failover chain)
      const aiResp = await env.NEXUS_AI.fetch("http://nexus-ai/ai/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          width,
          height,
        }),
      });

      const aiJson = (await aiResp.json()) as ApiResponse<{
        imageBase64: string;
        model: string;
        width: number;
        height: number;
      }>;

      if (!aiJson.success || !aiJson.data) {
        console.error(`[IMAGE] AI generation failed for ${platform}: ${aiJson.error}`);
        continue;
      }

      const { imageBase64, model } = aiJson.data;
      const r2Key = `products/${productId}/images/${platform}-${generateId()}.png`;

      // Upload to R2 via nexus-storage
      const uploadResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/r2/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: r2Key, data: imageBase64, contentType: "image/png" }),
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
          JSON.stringify({
            prompt: prompt.description,
            style: prompt.style,
            platform,
            model,
            width,
            height,
          }),
          now(),
        ]
      );

      results.push({ asset_id: assetId, r2_key: r2Key, url: assetUrl, platform, model });
      console.log(`[IMAGE] Generated ${platform} image via ${model}: ${r2Key}`);
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
  prompt: string,
  preferredProvider?: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType, prompt, preferredProvider }),
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
  prompt: string,
  preferredProvider?: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_VARIATION.fetch(
    "http://nexus-variation/variation/run",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskType, prompt, preferredProvider }),
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
/** Maximum retries per step (2 retries = 3 total attempts) */
export const STEP_MAX_RETRIES = 2;

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
