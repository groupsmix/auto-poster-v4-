import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { forwardToService, errorResponse, storageQuery } from "../helpers";

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

// POST /api/workflow/recover-stuck — mark stuck workflows as failed (7.1)
// Workflows stuck in "running" for over 30 minutes are considered timed out.
workflows.post("/recover-stuck", async (c) => {
  try {
    const result = await storageQuery(
      c.env,
      `UPDATE workflow_runs
       SET status = 'failed', error = 'Timed out — no progress for 30 minutes', completed_at = datetime('now')
       WHERE status = 'running'
       AND started_at < datetime('now', '-30 minutes')`,
      []
    ) as { meta?: { changes?: number } };

    const recovered = result?.meta?.changes ?? 0;

    // Also mark the products of those runs as failed
    if (recovered > 0) {
      await storageQuery(
        c.env,
        `UPDATE products SET status = 'failed', updated_at = datetime('now')
         WHERE id IN (
           SELECT product_id FROM workflow_runs
           WHERE status = 'failed'
           AND error = 'Timed out — no progress for 30 minutes'
         )
         AND status = 'running'`,
        []
      );
    }

    return c.json<ApiResponse>({
      success: true,
      data: { recovered },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/workflow/retry-from-step/:runId — retry from a specific step (7.2)
workflows.post("/retry-from-step/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");
    const body = await c.req.json<{ step_name: string }>();

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "runId is required" },
        400
      );
    }
    if (!body.step_name) {
      return c.json<ApiResponse>(
        { success: false, error: "step_name is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/retry-from-step/${runId}`,
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
