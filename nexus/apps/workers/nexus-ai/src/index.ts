// ============================================================
// nexus-ai Worker — Hono.js Entry Point
// Routes: /ai/run, /ai/health, /ai/registry, /ai/registry/reorder,
//         /ai/cache/stats, plus service health check
// ============================================================

import { Hono } from "hono";
import type { Env, ApiResponse } from "@nexus/shared";
import { runWithFailover, getModelStates } from "./failover";
import { runImageWithFailover } from "./image-failover";
import { getHealthReport, shouldSuggestReorder } from "./health";
import { getCacheStats } from "./cache";
import {
  TASK_MODEL_REGISTRY,
  getModelsForTask,
  getTaskTypes,
  persistRegistryReorder,
  loadPersistedReorders,
  loadRegistryFromD1,
} from "./registry";
import { runCEOSetup, getCEOConfig } from "./ceo";
import type { CEOSetupInput } from "./ceo";
import { runChatbot, gatherDashboardContext } from "./chatbot";
import type { ChatHistoryMessage } from "./chatbot";
import { generateDailyBriefing } from "./briefing";
import type { BriefingGenerateInput } from "./briefing";
import { getNeuronReport } from "./neuron-tracker";

const app = new Hono<{ Bindings: Env }>();

// ── Service root ─────────────────────────────────────────────

app.get("/", (c) => {
  return c.json({
    service: "nexus-ai",
    status: "ok",
    version: "0.2.0",
    endpoints: [
      "POST /ai/run",
      "GET  /ai/health",
      "GET  /ai/registry",
      "POST /ai/registry/reorder",
      "GET  /ai/cache/stats",
      "POST /ai/ceo/setup",
      "GET  /ai/ceo/config/:categorySlug",
      "POST /ai/image/generate",
    ],
  });
});

// ── Middleware: load registry from D1 + persisted reorders on first request ──

app.use("*", async (c, next) => {
  // D1-first: try to load dynamic registry from D1, fall back to hardcoded (code-review #18)
  await loadRegistryFromD1(c.env);
  await loadPersistedReorders(c.env);
  await next();
});

// ── POST /ai/run — main AI request endpoint ─────────────────

app.post("/ai/run", async (c) => {
  const body = await c.req.json<{ taskType?: string; prompt?: string; preferredProvider?: string }>();

  if (!body.taskType || !body.prompt) {
    return c.json<ApiResponse>(
      { success: false, error: "Missing required fields: taskType, prompt" },
      400
    );
  }

  const models = getModelsForTask(body.taskType);
  if (models.length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: `Unknown task type: ${body.taskType}` },
      400
    );
  }

  try {
    const result = await runWithFailover(body.taskType, body.prompt, c.env, body.preferredProvider);
    return c.json<ApiResponse>({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[FATAL] runWithFailover failed: ${message}`);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── POST /ai/image/generate — image generation with failover ──

app.post("/ai/image/generate", async (c) => {
  const body = await c.req.json<{
    prompt?: string;
    width?: number;
    height?: number;
    steps?: number;
  }>();

  if (!body.prompt) {
    return c.json<ApiResponse>(
      { success: false, error: "Missing required field: prompt" },
      400
    );
  }

  try {
    const result = await runImageWithFailover(body.prompt, c.env, {
      width: body.width,
      height: body.height,
      steps: body.steps,
    });
    return c.json<ApiResponse>({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[FATAL] Image generation failed: ${message}`);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── GET /ai/health — health report for all models ───────────

app.get("/ai/health", async (c) => {
  const report = await getHealthReport(c.env);
  const modelStates = await getModelStates(c.env);

  // Check for reorder suggestions across all task types (now async with 7-day window)
  const suggestionPromises = getTaskTypes().map((taskType) => {
    const models = getModelsForTask(taskType);
    return shouldSuggestReorder(
      taskType,
      models.map((m) => m.id),
      c.env
    );
  });
  const suggestions = (await Promise.all(suggestionPromises)).filter(Boolean);

  return c.json<ApiResponse>({
    success: true,
    data: {
      models: report,
      modelStates,
      suggestions,
    },
  });
});

// ── GET /ai/registry — returns the model registry ───────────

app.get("/ai/registry", (c) => {
  return c.json<ApiResponse>({
    success: true,
    data: {
      taskTypes: getTaskTypes(),
      registry: TASK_MODEL_REGISTRY,
    },
  });
});

// ── POST /ai/registry/reorder — manual reorder of model priority ──

app.post("/ai/registry/reorder", async (c) => {
  const body = await c.req.json<{
    taskType?: string;
    modelIds?: string[];
  }>();

  if (!body.taskType || !body.modelIds) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Missing required fields: taskType, modelIds",
      },
      400
    );
  }

  const currentModels = getModelsForTask(body.taskType);
  if (currentModels.length === 0) {
    return c.json<ApiResponse>(
      { success: false, error: `Unknown task type: ${body.taskType}` },
      400
    );
  }

  // Validate that all provided model IDs exist in the current chain
  const currentIds = new Set(currentModels.map((m) => m.id));
  for (const id of body.modelIds) {
    if (!currentIds.has(id)) {
      return c.json<ApiResponse>(
        { success: false, error: `Model ID not found in ${body.taskType}: ${id}` },
        400
      );
    }
  }

  // Reorder the registry in place
  const reordered = body.modelIds
    .map((id) => currentModels.find((m) => m.id === id))
    .filter(Boolean);

  // Add any models not in the reorder list at the end
  for (const model of currentModels) {
    if (!body.modelIds.includes(model.id)) {
      reordered.push(model);
    }
  }

  // Update the registry
  TASK_MODEL_REGISTRY[body.taskType] = reordered as typeof currentModels;

  // Persist to KV so the reorder survives worker restarts
  const finalOrder = reordered.map((m) => m!.id);
  await persistRegistryReorder(body.taskType, finalOrder, c.env);

  console.log(`[REORDER] ${body.taskType} -> [${finalOrder.join(", ")}]`);

  return c.json<ApiResponse>({
    success: true,
    data: {
      taskType: body.taskType,
      newOrder: finalOrder,
    },
  });
});

// ── GET /ai/cache/stats — cache hit/miss statistics ─────────

app.get("/ai/cache/stats", async (c) => {
  return c.json<ApiResponse>({
    success: true,
    data: await getCacheStats(c.env),
  });
});

// ── POST /ai/ceo/setup — AI CEO auto-orchestration ──────────
// Deeply analyzes a domain + category niche and generates
// expert-level prompt templates + workflow configuration.

app.post("/ai/ceo/setup", async (c) => {
  const body = await c.req.json<CEOSetupInput>();

  if (!body.domain_name || !body.category_name) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Missing required fields: domain_name, category_name",
      },
      400
    );
  }

  if (!body.domain_slug || !body.category_slug) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Missing required fields: domain_slug, category_slug",
      },
      400
    );
  }

  try {
    const result = await runCEOSetup(body, c.env);
    return c.json<ApiResponse>({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CEO] Setup failed: ${message}`);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── GET /ai/ceo/config/:categorySlug — get existing CEO config ──

app.get("/ai/ceo/config/:categorySlug", async (c) => {
  const categorySlug = c.req.param("categorySlug");

  if (!categorySlug) {
    return c.json<ApiResponse>(
      { success: false, error: "categorySlug is required" },
      400
    );
  }

  try {
    const config = await getCEOConfig(categorySlug, c.env);

    if (!config) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: `No CEO configuration found for category: ${categorySlug}`,
        },
        404
      );
    }

    return c.json<ApiResponse>({ success: true, data: config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── POST /ai/chatbot/chat — AI chatbot conversation ──────────
// Takes a user message + conversation history, returns AI response
// with optional proposed actions.

app.post("/ai/chatbot/chat", async (c) => {
  const body = await c.req.json<{
    message?: string;
    history?: ChatHistoryMessage[];
  }>();

  if (!body.message) {
    return c.json<ApiResponse>(
      { success: false, error: "Missing required field: message" },
      400
    );
  }

  try {
    const result = await runChatbot(
      body.message,
      body.history ?? [],
      c.env
    );
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CHATBOT] Chat failed: ${message}`);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── POST /ai/briefing/generate — generate daily intelligence briefing ──

app.post("/ai/briefing/generate", async (c) => {
  const body = await c.req.json<BriefingGenerateInput>();

  try {
    const result = await generateDailyBriefing(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[BRIEFING] Generation failed: ${message}`);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── GET /ai/neurons — Workers AI neuron usage report ───────

app.get("/ai/neurons", async (c) => {
  try {
    const report = await getNeuronReport(c.env);
    return c.json<ApiResponse>({ success: true, data: report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── POST /ai/keys/:envName — store an API key in KV ─────────
// Allows the dashboard to manage API keys without wrangler CLI.
// Keys are stored in KV under "apikey:{ENV_NAME}" and read by
// the failover engine when env vars don't have the key.

app.post("/ai/keys/:envName", async (c) => {
  const envName = c.req.param("envName");
  const body = await c.req.json<{ api_key?: string }>();

  if (!body.api_key || !envName) {
    return c.json<ApiResponse>(
      { success: false, error: "envName and api_key are required" },
      400
    );
  }

  try {
    await c.env.KV.put(`apikey:${envName}`, body.api_key, {
      // No expiration — persists until explicitly deleted
    });
    console.log(`[KEYS] Stored API key for ${envName} in KV`);
    return c.json<ApiResponse>({
      success: true,
      data: { env_name: envName, status: "stored" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── DELETE /ai/keys/:envName — remove an API key from KV ────

app.delete("/ai/keys/:envName", async (c) => {
  const envName = c.req.param("envName");

  try {
    await c.env.KV.delete(`apikey:${envName}`);
    console.log(`[KEYS] Removed API key for ${envName} from KV`);
    return c.json<ApiResponse>({
      success: true,
      data: { env_name: envName, status: "removed" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── GET /ai/keys — list which API keys are configured in KV ──

app.get("/ai/keys", async (c) => {
  try {
    const kvList = await c.env.KV.list({ prefix: "apikey:" });
    const keys = kvList.keys.map((k) => ({
      env_name: k.name.replace("apikey:", ""),
      status: "stored",
    }));
    return c.json<ApiResponse>({ success: true, data: keys });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// ── GET /ai/chatbot/context — get current dashboard context ──

app.get("/ai/chatbot/context", async (c) => {
  try {
    const context = await gatherDashboardContext(c.env);
    return c.json<ApiResponse>({ success: true, data: { context } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

export default app;
