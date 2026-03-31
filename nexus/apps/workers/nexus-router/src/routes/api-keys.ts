import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { ModelStatus } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const apiKeys = new Hono<{ Bindings: RouterEnv }>();

// Known API key names and their display names
const KNOWN_KEYS: Record<string, string> = {
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
    // Query ai_models to check which keys are configured
    const models = (await storageQuery(
      c.env,
      "SELECT api_key_secret_name, status FROM ai_models WHERE api_key_secret_name IS NOT NULL"
    )) as { api_key_secret_name: string; status: string }[];

    const configuredKeys = new Set(
      (models || []).map((m) => m.api_key_secret_name)
    );

    const keys = Object.entries(KNOWN_KEYS).map(([key_name, display_name]) => ({
      key_name,
      display_name,
      status: configuredKeys.has(key_name) ? "active" : ("not_set" as const),
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
      return c.json<ApiResponse>(
        { success: false, error: "api_key is required" },
        400
      );
    }

    // Update all ai_models that use this key name
    await storageQuery(
      c.env,
      `UPDATE ai_models SET status = '${ModelStatus.ACTIVE}' WHERE api_key_secret_name = ?`,
      [keyName]
    );

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

    // Set models using this key to sleeping
    await storageQuery(
      c.env,
      `UPDATE ai_models SET status = '${ModelStatus.SLEEPING}' WHERE api_key_secret_name = ?`,
      [keyName]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { key_name: keyName, status: "not_set" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default apiKeys;
