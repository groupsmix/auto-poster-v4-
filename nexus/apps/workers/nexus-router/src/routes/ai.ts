import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { ModelStatus } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { forwardToService, storageQuery, errorResponse } from "../helpers";

const ai = new Hono<{ Bindings: RouterEnv }>();

// GET /api/ai/models — list all AI models with health
ai.get("/models", async (c) => {
  try {
    const result = await forwardToService(c.env.NEXUS_AI, "/ai/registry");
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/ai/models/:id — get single AI model
ai.get("/models/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const results = await storageQuery<Record<string, unknown>[]>(
      c.env,
      "SELECT * FROM ai_models WHERE id = ? LIMIT 1",
      [id]
    );
    if (!results || results.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "AI model not found" },
        404
      );
    }
    return c.json<ApiResponse>({ success: true, data: results[0] });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/ai/models/:id/key — add/update API key for an AI model
ai.post("/models/:id/key", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{ api_key?: string }>();

    if (!body.api_key) {
      return c.json<ApiResponse>(
        { success: false, error: "api_key is required" },
        400
      );
    }

    // Look up the model's apiKeyEnvName from the registry
    const registryRes = await forwardToService(c.env.NEXUS_AI, "/ai/registry");
    let envName: string | null = null;
    if (registryRes.success && registryRes.data) {
      const registry = (registryRes.data as { registry: Record<string, Array<{ id: string; apiKeyEnvName?: string }>> }).registry;
      for (const models of Object.values(registry)) {
        const found = models.find((m) => m.id === id);
        if (found?.apiKeyEnvName) {
          envName = found.apiKeyEnvName;
          break;
        }
      }
    }

    if (!envName) {
      return c.json<ApiResponse>(
        { success: false, error: `Could not find API key env name for model: ${id}` },
        404
      );
    }

    // Store the actual API key in KV via nexus-ai
    const kvResult = await forwardToService(
      c.env.NEXUS_AI,
      `/ai/keys/${envName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: body.api_key }),
      }
    );

    if (!kvResult.success) {
      return c.json<ApiResponse>(kvResult, 500);
    }

    // Also update D1 model status
    await storageQuery(
      c.env,
      `UPDATE ai_models SET api_key_secret_name = ?, status = '${ModelStatus.ACTIVE}' WHERE id = ?`,
      [envName, id]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { id, env_name: envName, status: "active" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/ai/models/:id/key — remove API key from an AI model
ai.delete("/models/:id/key", async (c) => {
  try {
    const id = c.req.param("id");

    // Look up the model's apiKeyEnvName from the registry
    const registryRes = await forwardToService(c.env.NEXUS_AI, "/ai/registry");
    let envName: string | null = null;
    if (registryRes.success && registryRes.data) {
      const registry = (registryRes.data as { registry: Record<string, Array<{ id: string; apiKeyEnvName?: string }>> }).registry;
      for (const models of Object.values(registry)) {
        const found = models.find((m) => m.id === id);
        if (found?.apiKeyEnvName) {
          envName = found.apiKeyEnvName;
          break;
        }
      }
    }

    // Remove from KV if we found the env name
    if (envName) {
      await forwardToService(
        c.env.NEXUS_AI,
        `/ai/keys/${envName}`,
        { method: "DELETE" }
      );
    }

    // Update D1 model status
    await storageQuery(
      c.env,
      `UPDATE ai_models SET api_key_secret_name = NULL, status = '${ModelStatus.SLEEPING}' WHERE id = ?`,
      [id]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { id, status: "sleeping" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/ai/health — health report
ai.get("/health", async (c) => {
  try {
    const result = await forwardToService(c.env.NEXUS_AI, "/ai/health");
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/ai/models/reorder — reorder failover chain
ai.post("/models/reorder", async (c) => {
  try {
    const body = await c.req.json<{
      taskType?: string;
      modelIds?: string[];
    }>();

    if (!body.taskType || !body.modelIds) {
      return c.json<ApiResponse>(
        { success: false, error: "taskType and modelIds are required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_AI,
      "/ai/registry/reorder",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 400);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default ai;
