import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { ModelStatus } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService, errorResponse } from "../helpers";

const apiKeys = new Hono<{ Bindings: RouterEnv }>();

// Known API key names and their display names
const KNOWN_KEYS: Record<string, string> = {
  TOGETHER_API_KEY: "Together.ai",
  DEEPSEEK_API_KEY: "DeepSeek",
  SILICONFLOW_API_KEY: "SiliconFlow",
  FIREWORKS_API_KEY: "Fireworks",
  GROQ_API_KEY: "Groq",
  HF_TOKEN: "Hugging Face",
  OPENROUTER_API_KEY: "OpenRouter",
  MOONSHOT_API_KEY: "Moonshot",
  FAL_API_KEY: "Fal.ai",
  TAVILY_API_KEY: "Tavily",
  EXA_API_KEY: "Exa",
  SERPAPI_KEY: "SerpAPI",
  DATAFORSEO_KEY: "DataForSEO",
  PRINTFUL_API_KEY: "Printful",
  PRINTIFY_API_KEY: "Printify",
  SUNO_API_KEY: "Suno",
  ANTHROPIC_API_KEY: "Anthropic",
  OPENAI_API_KEY: "OpenAI",
  GOOGLE_API_KEY: "Google",
  MIDJOURNEY_API_KEY: "Midjourney",
  IDEOGRAM_API_KEY: "Ideogram",
  ELEVENLABS_API_KEY: "ElevenLabs",
  CARTESIA_API_KEY: "Cartesia",
  PERPLEXITY_API_KEY: "Perplexity",
  PLACEIT_API_KEY: "Placeit",
};

// GET /api/api-keys — list all known API keys and their status
apiKeys.get("/", async (c) => {
  try {
    // Check KV for stored keys via nexus-ai
    let kvKeys = new Set<string>();
    try {
      const kvRes = await forwardToService(c.env.NEXUS_AI, "/ai/keys");
      if (kvRes.success && Array.isArray(kvRes.data)) {
        kvKeys = new Set(
          (kvRes.data as Array<{ env_name: string }>).map((k) => k.env_name)
        );
      }
    } catch {
      // KV query failed — continue with DB fallback
      console.warn("[api-keys] Failed to query KV keys");
    }

    // Also check D1 for any keys marked active there
    let dbKeys = new Set<string>();
    try {
      const models = await storageQuery<{ api_key_secret_name: string; status: string }[]>(
        c.env,
        "SELECT api_key_secret_name, status FROM ai_models WHERE api_key_secret_name IS NOT NULL AND status = 'active'"
      );
      dbKeys = new Set(
        (models || []).map((m) => m.api_key_secret_name)
      );
    } catch {
      // DB query failed — continue with empty set so keys still render
      console.warn("[api-keys] Failed to query ai_models, showing all keys as not_set");
    }

    // A key is active if it's in KV (dashboard-managed) OR in D1 (legacy)
    const keys = Object.entries(KNOWN_KEYS).map(([key_name, display_name]) => ({
      key_name,
      display_name,
      status: kvKeys.has(key_name) || dbKeys.has(key_name) ? "active" : ("not_set" as const),
    }));

    return c.json<ApiResponse>({ success: true, data: keys });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/api-keys/:keyName — add/update an API key
apiKeys.post("/:keyName", async (c) => {
  try {
    const keyName = c.req.param("keyName");
    const body = await c.req.json<{ api_key?: string }>();

    if (!body.api_key) {
      return errorResponse(c, new Error("api_key is required"), 400);
    }

    // Store the actual key value in KV via nexus-ai
    const kvResult = await forwardToService(
      c.env.NEXUS_AI,
      `/ai/keys/${keyName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: body.api_key }),
      }
    );

    if (!kvResult.success) {
      return c.json<ApiResponse>(kvResult, 500);
    }

    // Also update D1 model status for models using this key
    await storageQuery(
      c.env,
      `UPDATE ai_models SET api_key_secret_name = ?, status = '${ModelStatus.ACTIVE}' WHERE api_key_secret_name = ? OR api_key_secret_name IS NULL`,
      [keyName, keyName]
    ).catch(() => {
      // Non-critical — KV is the source of truth now
      console.warn(`[api-keys] Could not update D1 for ${keyName}`);
    });

    return c.json<ApiResponse>({
      success: true,
      data: { key_name: keyName, status: "active" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/api-keys/:keyName — remove an API key
apiKeys.delete("/:keyName", async (c) => {
  try {
    const keyName = c.req.param("keyName");

    // Remove from KV via nexus-ai
    await forwardToService(
      c.env.NEXUS_AI,
      `/ai/keys/${keyName}`,
      { method: "DELETE" }
    );

    // Also update D1 model status
    await storageQuery(
      c.env,
      `UPDATE ai_models SET status = '${ModelStatus.SLEEPING}' WHERE api_key_secret_name = ?`,
      [keyName]
    ).catch(() => {
      console.warn(`[api-keys] Could not update D1 for ${keyName}`);
    });

    return c.json<ApiResponse>({
      success: true,
      data: { key_name: keyName, status: "not_set" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default apiKeys;
