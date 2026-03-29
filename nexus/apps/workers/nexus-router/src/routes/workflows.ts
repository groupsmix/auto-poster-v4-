import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { forwardToService, errorResponse } from "../helpers";

const workflows = new Hono<{ Bindings: RouterEnv }>();

// POST /api/workflow/start — start workflow (or batch)
workflows.post("/start", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.domain_id || !body.category_id || !body.niche) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "domain_id, category_id, and niche are required",
        },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      "/workflow/start",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 500);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/workflow/cancel/:runId — cancel workflow
workflows.post("/cancel/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "runId is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/cancel/${runId}`,
      { method: "POST" }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 500);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/workflow/status/:runId — get workflow status
workflows.get("/status/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "runId is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/status/${runId}`
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 404);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/workflow/batch/:batchId — get batch progress
workflows.get("/batch/:batchId", async (c) => {
  try {
    const batchId = c.req.param("batchId");

    if (!batchId) {
      return c.json<ApiResponse>(
        { success: false, error: "batchId is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/batch/${batchId}`
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 404);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/workflow/revise/:runId — revise with feedback
workflows.post("/revise/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");
    const body = await c.req.json<{ feedback?: string; steps?: string[] }>();

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "runId is required" },
        400
      );
    }
    if (!body.feedback) {
      return c.json<ApiResponse>(
        { success: false, error: "feedback is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/revise/${runId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 500);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default workflows;
