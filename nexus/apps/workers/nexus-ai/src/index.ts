// ============================================================
// nexus-ai Worker — Hono.js Entry Point
// Routes: /ai/run, /ai/health, /ai/registry, /ai/registry/reorder,
//         /ai/cache/stats, plus service health check
// ============================================================

import { Hono } from "hono";
import type { Env } from "@nexus/shared";
import { runWithFailover, getModelStates } from "./failover";
import { getHealthReport, shouldSuggestReorder } from "./health";
import { getCacheStats } from "./cache";
import {
  TASK_MODEL_REGISTRY,
  getModelsForTask,
  getTaskTypes,
} from "./registry";

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
    ],
  });
});

// ── POST /ai/run — main AI request endpoint ─────────────────

app.post("/ai/run", async (c) => {
  const body = await c.req.json<{ taskType?: string; prompt?: string }>();

  if (!body.taskType || !body.prompt) {
    return c.json(
      { success: false, error: "Missing required fields: taskType, prompt" },
      400
    );
  }

  const models = getModelsForTask(body.taskType);
  if (models.length === 0) {
    return c.json(
      { success: false, error: `Unknown task type: ${body.taskType}` },
      400
    );
  }

  try {
    const result = await runWithFailover(body.taskType, body.prompt, c.env);
    return c.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[FATAL] runWithFailover failed: ${message}`);
    return c.json({ success: false, error: message }, 500);
  }
});

// ── GET /ai/health — health report for all models ───────────

app.get("/ai/health", async (c) => {
  const report = await getHealthReport(c.env);
  const modelStates = await getModelStates(c.env);

  // Check for reorder suggestions across all task types
  const suggestions = getTaskTypes()
    .map((taskType) => {
      const models = getModelsForTask(taskType);
      return shouldSuggestReorder(
        taskType,
        models.map((m) => m.id)
      );
    })
    .filter(Boolean);

  return c.json({
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
  return c.json({
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
    return c.json(
      {
        success: false,
        error: "Missing required fields: taskType, modelIds",
      },
      400
    );
  }

  const currentModels = getModelsForTask(body.taskType);
  if (currentModels.length === 0) {
    return c.json(
      { success: false, error: `Unknown task type: ${body.taskType}` },
      400
    );
  }

  // Validate that all provided model IDs exist in the current chain
  const currentIds = new Set(currentModels.map((m) => m.id));
  for (const id of body.modelIds) {
    if (!currentIds.has(id)) {
      return c.json(
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

  console.log(`[REORDER] ${body.taskType} -> [${body.modelIds.join(", ")}]`);

  return c.json({
    success: true,
    data: {
      taskType: body.taskType,
      newOrder: reordered.map((m) => m!.id),
    },
  });
});

// ── GET /ai/cache/stats — cache hit/miss statistics ─────────

app.get("/ai/cache/stats", async (c) => {
  return c.json({
    success: true,
    data: await getCacheStats(c.env),
  });
});

export default app;
