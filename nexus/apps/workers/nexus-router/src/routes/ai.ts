import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { forwardToService, errorResponse } from "../helpers";

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
