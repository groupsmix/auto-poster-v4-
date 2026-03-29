// ============================================================
// nexus-workflow — Hono.js Worker Entry Point
// Manages CF Workflows instances, step orchestration,
// batch workflows, and status tracking
// ============================================================

import { Hono } from "hono";
import type { Env, ProductSetupInput, ApiResponse } from "@nexus/shared";
import { generateId, slugify, now } from "@nexus/shared";
import { WorkflowEngine, type WorkflowInput } from "./engine";
import { BatchOrchestrator, type BatchInput } from "./batch";
import type { ProductContext, StepName } from "./steps";

const app = new Hono<{ Bindings: Env }>();

// --- Health & info routes ---

app.get("/", (c) => {
  return c.json({
    service: "nexus-workflow",
    status: "ok",
    version: "0.1.0",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// --- Helper: call nexus-storage D1 queries ---

async function storageQuery(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<unknown> {
  const response = await env.NEXUS_STORAGE.fetch(
    "http://nexus-storage/d1/query",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }
  );

  const json = (await response.json()) as ApiResponse;
  if (!json.success) {
    throw new Error(`Storage query failed: ${json.error ?? "Unknown error"}`);
  }
  return json.data;
}

// --- Helper: load prompt templates from KV ---

async function loadPromptTemplates(
  env: Env
): Promise<{
  master?: string;
  roles?: Record<string, string>;
  domains?: Record<string, string>;
  categories?: Record<string, string>;
  platforms?: Record<string, string>;
}> {
  const templates: {
    master?: string;
    roles?: Record<string, string>;
    domains?: Record<string, string>;
    categories?: Record<string, string>;
    platforms?: Record<string, string>;
  } = {};

  try {
    const masterResp = await env.NEXUS_STORAGE.fetch(
      "http://nexus-storage/kv/prompt:master"
    );
    const masterJson = (await masterResp.json()) as ApiResponse<string>;
    if (masterJson.success && masterJson.data) {
      templates.master =
        typeof masterJson.data === "string"
          ? masterJson.data
          : JSON.stringify(masterJson.data);
    }
  } catch {
    // Master prompt optional
  }

  try {
    const roleNames = ["researcher", "copywriter", "seo", "reviewer"];
    const roles: Record<string, string> = {};
    for (const role of roleNames) {
      const resp = await env.NEXUS_STORAGE.fetch(
        `http://nexus-storage/kv/prompt:role:${role}`
      );
      const json = (await resp.json()) as ApiResponse<string>;
      if (json.success && json.data) {
        roles[role] =
          typeof json.data === "string"
            ? json.data
            : JSON.stringify(json.data);
      }
    }
    templates.roles = roles;
  } catch {
    // Role prompts optional
  }

  return templates;
}

// ============================================================
// POST /workflow/start — Create a new workflow (or batch)
// Body: ProductSetupInput
// ============================================================

app.post("/workflow/start", async (c) => {
  try {
    const body = await c.req.json<ProductSetupInput>();

    // Validate required fields
    if (!body.domain_id || !body.category_id || !body.niche) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Missing required fields: domain_id, category_id, niche",
        },
        400
      );
    }

    const batchCount = body.batch_count ?? 1;

    // --- Batch mode (2+ products) ---
    if (batchCount > 1) {
      const batchOrchestrator = new BatchOrchestrator(c.env);

      const batchInput: BatchInput = {
        domain_id: body.domain_id,
        domain_slug: body.domain_id, // Will resolve slug from domain ID
        category_id: body.category_id,
        category_slug: body.category_id,
        language: body.language ?? "en",
        niche: body.niche,
        name: body.name,
        description: body.description,
        keywords: body.keywords,
        platforms: body.platforms ?? [],
        social_channels: body.social_channels ?? [],
        batch_count: batchCount,
        user_input: {
          target_audience: body.target_audience,
          design_style: body.design_style,
          price_suggestion: body.price_suggestion,
          posting_mode: body.posting_mode,
          social_enabled: body.social_enabled,
        },
      };

      const result = await batchOrchestrator.createBatchWorkflow(batchInput);

      return c.json<ApiResponse>({
        success: true,
        data: {
          batch_id: result.batchId,
          batch_count: result.products.length,
          products: result.products,
        },
      });
    }

    // --- Single workflow mode ---
    const engine = new WorkflowEngine(c.env);
    const productId = generateId();
    const productName = body.name ?? body.niche;
    const slug = slugify(productName);

    // Create product record in D1
    await storageQuery(
      c.env,
      `INSERT INTO products (id, domain_id, category_id, name, slug, niche, language, status, user_input, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
      [
        productId,
        body.domain_id,
        body.category_id,
        productName,
        slug,
        body.niche,
        body.language ?? "en",
        JSON.stringify({
          domain_slug: body.domain_id,
          category_slug: body.category_id,
          platforms: body.platforms ?? [],
          social_channels: body.social_channels ?? [],
          keywords: body.keywords,
          description: body.description,
          target_audience: body.target_audience,
          design_style: body.design_style,
          price_suggestion: body.price_suggestion,
          posting_mode: body.posting_mode,
          social_enabled: body.social_enabled,
        }),
        now(),
        now(),
      ]
    );

    // Load prompt templates
    const promptTemplates = await loadPromptTemplates(c.env);

    // Build product context
    const productContext: ProductContext = {
      domain_id: body.domain_id,
      domain_slug: body.domain_id,
      category_id: body.category_id,
      category_slug: body.category_id,
      niche: body.niche,
      name: body.name,
      description: body.description,
      keywords: body.keywords,
      language: body.language ?? "en",
      platforms: body.platforms ?? [],
      social_channels: body.social_channels ?? [],
      user_input: {
        target_audience: body.target_audience,
        design_style: body.design_style,
        price_suggestion: body.price_suggestion,
      },
    };

    const workflowInput: WorkflowInput = {
      productId,
      product: productContext,
      promptTemplates,
    };

    const { runId } = await engine.createWorkflow(productId, workflowInput);

    return c.json<ApiResponse>({
      success: true,
      data: {
        product_id: productId,
        run_id: runId,
        status: "running",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Start failed:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

// ============================================================
// POST /workflow/cancel/:runId — Cancel a running workflow
// ============================================================

app.post("/workflow/cancel/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing runId parameter" },
        400
      );
    }

    const engine = new WorkflowEngine(c.env);
    await engine.cancelWorkflow(runId);

    return c.json<ApiResponse>({
      success: true,
      data: { run_id: runId, status: "cancelled" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Cancel failed:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

// ============================================================
// GET /workflow/status/:runId — Get workflow + step statuses
// ============================================================

app.get("/workflow/status/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing runId parameter" },
        400
      );
    }

    const engine = new WorkflowEngine(c.env);
    const status = await engine.getWorkflowStatus(runId);

    if (!status) {
      return c.json<ApiResponse>(
        { success: false, error: `Workflow run ${runId} not found` },
        404
      );
    }

    return c.json<ApiResponse>({
      success: true,
      data: status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Status check failed:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

// ============================================================
// GET /workflow/batch/:batchId — Get batch progress
// ============================================================

app.get("/workflow/batch/:batchId", async (c) => {
  try {
    const batchId = c.req.param("batchId");

    if (!batchId) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing batchId parameter" },
        400
      );
    }

    const orchestrator = new BatchOrchestrator(c.env);
    const progress = await orchestrator.getBatchProgress(batchId);

    if (!progress) {
      return c.json<ApiResponse>(
        { success: false, error: `Batch ${batchId} not found` },
        404
      );
    }

    return c.json<ApiResponse>({
      success: true,
      data: progress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Batch progress check failed:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

// ============================================================
// POST /workflow/revise/:runId — Re-run failed steps with
// CEO feedback (rejection loop)
// ============================================================

app.post("/workflow/revise/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing runId parameter" },
        400
      );
    }

    const body = await c.req.json<{
      feedback: string;
      steps?: StepName[];
    }>();

    if (!body.feedback) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing feedback in request body" },
        400
      );
    }

    const engine = new WorkflowEngine(c.env);
    const result = await engine.reviseWorkflow(
      runId,
      body.feedback,
      body.steps
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        run_id: result.runId,
        status: "in_revision",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Revision failed:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

export default app;
