import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { PRODUCT_STATUS, WorkflowRunStatus } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { forwardToService, errorResponse, storageQuery, validateStringField, sanitizeInput } from "../helpers";

const workflows = new Hono<{ Bindings: RouterEnv }>();

// POST /api/workflow/start — start workflow (or batch)
workflows.post("/start", async (c) => {
  try {
    const body = await c.req.json();

    const domainId = validateStringField(body, "domain_id");
    const categoryId = validateStringField(body, "category_id");

    if (!domainId || !categoryId) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "domain_id and category_id are required (non-empty strings)",
        },
        400
      );
    }
    // Replace raw values with sanitized ones
    body.domain_id = domainId;
    body.category_id = categoryId;

    // Sanitize niche if provided (optional field)
    const niche = validateStringField(body, "niche");
    if (niche) {
      body.niche = niche;
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
    const feedback = validateStringField(body as Record<string, unknown>, "feedback");
    if (!feedback) {
      return c.json<ApiResponse>(
        { success: false, error: "feedback is required (non-empty string)" },
        400
      );
    }
    body.feedback = feedback;

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
              SET status = '${WorkflowRunStatus.FAILED}', error = 'Timed out — no progress for 30 minutes', completed_at = datetime('now')
              WHERE status = '${WorkflowRunStatus.RUNNING}'
       AND started_at < datetime('now', '-30 minutes')`,
      []
    ) as { meta?: { changes?: number } };

    const recovered = result?.meta?.changes ?? 0;

    // Also mark the products of those runs as failed
    if (recovered > 0) {
      await storageQuery(
        c.env,
                `UPDATE products SET status = '${PRODUCT_STATUS.FAILED}', updated_at = datetime('now')
                 WHERE id IN (
                   SELECT product_id FROM workflow_runs
                   WHERE status = '${WorkflowRunStatus.FAILED}'
                   AND error = 'Timed out — no progress for 30 minutes'
                 )
                 AND status = '${PRODUCT_STATUS.RUNNING}'`,
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
    const stepName = validateStringField(body as Record<string, unknown>, "step_name");
    if (!stepName) {
      return c.json<ApiResponse>(
        { success: false, error: "step_name is required (non-empty string)" },
        400
      );
    }
    body.step_name = stepName;

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

// POST /api/workflow/products/:productId/regenerate-images — regenerate platform images
workflows.post("/products/:productId/regenerate-images", async (c) => {
  try {
    const productId = c.req.param("productId");

    if (!productId) {
      return c.json<ApiResponse>(
        { success: false, error: "productId is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/products/${productId}/regenerate-images`,
      { method: "POST" }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 500);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default workflows;
