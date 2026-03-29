// ============================================================
// nexus-ai Worker — Hono.js Entry Point
// Exposes AI failover engine, health, registry, and cache APIs
// Called via Service Binding from nexus-workflow
// ============================================================

import { Hono } from "hono";
import { runWithFailover } from "./failover";
import { getHealthReport, shouldSuggestReorder } from "./health";
import {
  TASK_MODEL_REGISTRY,
  getModelsForTask,
  getTaskTypes,
} from "./registry";
import { getCacheStats } from "./cache";
import { getRecentCalls } from "./gateway";

/** Env bindings for this worker */
interface Env {
  AI: {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
  };
  KV: KVNamespace;
  AI_GATEWAY_ACCOUNT_ID: string;
  AI_GATEWAY_ID: string;
  [key: string]: unknown;
}

const app = new Hono<{ Bindings: Env }>();

// ============================================================
// SERVICE INFO
// ============================================================

app.get("/", (c) => {
  return c.json({
    service: "nexus-ai",
    status: "ok",
    version: "0.2.0",
    endpoints: [
      "POST /ai/run",
      "GET /ai/health",
      "GET /ai/registry",
      "POST /ai/registry/reorder",
      "GET /ai/cache/stats",
      "GET /ai/gateway/calls",
    ],
  });
});

// ============================================================
// POST /ai/run — Main AI execution endpoint
// Body: { taskType: string, prompt: string }
// Returns: { result, model, cached, tokens?, latencyMs? }
// ============================================================

app.post("/ai/run", async (c) => {
  const body = await c.req.json<{ taskType: string; prompt: string }>();

  if (!body.taskType || !body.prompt) {
    return c.json({ error: "taskType and prompt are required" }, 400);
  }

  const models = getModelsForTask(body.taskType);
  if (models.length === 0) {
    return c.json(
      { error: `Unknown task type: ${body.taskType}` },
      400
    );
  }

  try {
    const result = await runWithFailover(body.taskType, body.prompt, c.env);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[FATAL] runWithFailover failed: ${message}`);
    return c.json({ error: message }, 500);
  }
});

// ============================================================
// GET /ai/health — Health report for all AI models
// Returns: { models: [...], generatedAt, suggestions: [...] }
// ============================================================

app.get("/ai/health", (c) => {
  const report = getHealthReport();

  // Check for reorder suggestions across all task types
  const suggestions = [];
  for (const taskType of getTaskTypes()) {
    const models = getModelsForTask(taskType);
    const modelIds = models.map((m) => m.id);
    const suggestion = shouldSuggestReorder(taskType, modelIds);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return c.json({
    ...report,
    suggestions,
  });
});

// ============================================================
// GET /ai/registry — Returns the full model registry
// Used by the AI Manager UI to display model configuration
// ============================================================

app.get("/ai/registry", (c) => {
  const taskTypes = getTaskTypes();
  const registry: Record<
    string,
    Array<{ id: string; name: string; provider: string; isWorkersAI: boolean; isFree: boolean }>
  > = {};

  for (const taskType of taskTypes) {
    registry[taskType] = getModelsForTask(taskType).map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      isWorkersAI: m.isWorkersAI,
      isFree: m.isFree,
    }));
  }

  return c.json({
    taskTypes,
    registry,
    totalModels: Object.values(registry).reduce(
      (sum, models) => sum + models.length,
      0
    ),
  });
});

// ============================================================
// POST /ai/registry/reorder — Manual reorder of model priority
// Body: { taskType: string, modelIds: string[] }
// NOTE: Runtime-only reorder (resets on worker restart)
// Permanent changes should be made in registry.ts
// ============================================================

app.post("/ai/registry/reorder", async (c) => {
  const body = await c.req.json<{
    taskType: string;
    modelIds: string[];
  }>();

  if (!body.taskType || !body.modelIds?.length) {
    return c.json(
      { error: "taskType and modelIds are required" },
      400
    );
  }

  const currentModels = TASK_MODEL_REGISTRY[body.taskType];
  if (!currentModels) {
    return c.json(
      { error: `Unknown task type: ${body.taskType}` },
      400
    );
  }

  // Validate all model IDs exist in the current chain
  const currentIds = new Set(currentModels.map((m) => m.id));
  for (const id of body.modelIds) {
    if (!currentIds.has(id)) {
      return c.json(
        { error: `Model ${id} not found in ${body.taskType} chain` },
        400
      );
    }
  }

  // Reorder: build new array matching the requested order
  const reordered = body.modelIds
    .map((id) => currentModels.find((m) => m.id === id))
    .filter(Boolean);

  // Add any models not in the request (keep at end)
  for (const model of currentModels) {
    if (!body.modelIds.includes(model.id)) {
      reordered.push(model);
    }
  }

  // Update the registry in-memory (runtime only)
  TASK_MODEL_REGISTRY[body.taskType] = reordered as typeof currentModels;

  return c.json({
    success: true,
    taskType: body.taskType,
    newOrder: reordered.map((m) => m?.id),
    note: "Runtime-only reorder. Will reset on worker restart.",
  });
});

// ============================================================
// GET /ai/cache/stats — Cache hit/miss statistics
// ============================================================

app.get("/ai/cache/stats", (c) => {
  return c.json(getCacheStats());
});

// ============================================================
// GET /ai/gateway/calls — Recent AI Gateway call log
// ============================================================

app.get("/ai/gateway/calls", (c) => {
  return c.json({
    calls: getRecentCalls(),
    count: getRecentCalls().length,
  });
});

export default app;
