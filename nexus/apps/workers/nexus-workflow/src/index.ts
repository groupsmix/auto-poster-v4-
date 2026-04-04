// ============================================================
// nexus-workflow — Hono.js Worker Entry Point
// Manages CF Workflows instances, step orchestration,
// batch workflows, and status tracking
// ============================================================

import { Hono } from "hono";
import type { Env, ProductSetupInput, ApiResponse } from "@nexus/shared";
import { generateId, slugify, now } from "@nexus/shared";
import { WorkflowEngine, type WorkflowInput } from "./engine";
import type { CEOWorkflowConfig } from "./engine/types";
import { BatchOrchestrator, type BatchInput } from "./batch";
import type { ProductContext, StepName } from "./steps";
import { ProjectBuilderEngine } from "./project-builder";
import type { ProjectBuildInput } from "@nexus/shared";

const app = new Hono<{ Bindings: Env }>();

/** Safely extract ExecutionContext — returns undefined in test environments */
function getExecutionCtx(c: { executionCtx: ExecutionContext }): ExecutionContext | undefined {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

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

// --- Helper: load CEO workflow config from KV ---

async function loadCEOWorkflowConfig(
  env: Env,
  categorySlug: string
): Promise<CEOWorkflowConfig | undefined> {
  if (!categorySlug) return undefined;

  try {
    const resp = await env.NEXUS_STORAGE.fetch(
      `http://nexus-storage/kv/ceo:workflow:${categorySlug}`
    );
    const json = (await resp.json()) as ApiResponse<string>;
    if (json.success && json.data) {
      const raw = typeof json.data === "string" ? json.data : JSON.stringify(json.data);
      return JSON.parse(raw) as CEOWorkflowConfig;
    }
  } catch {
    // CEO config is optional — workflow runs fine without it
    console.warn(`[WORKFLOW] No CEO workflow config found for category: ${categorySlug}`);
  }

  return undefined;
}

// --- Helper: resolve domain/category slug to actual DB id ---

async function resolveDomainId(
  env: Env,
  slugOrId: string
): Promise<{ id: string; slug: string } | null> {
  // Try matching by id first, then by slug
  const result = (await storageQuery(
    env,
    "SELECT id, slug FROM domains WHERE id = ? OR slug = ? LIMIT 1",
    [slugOrId, slugOrId]
  )) as { results?: Array<{ id: string; slug: string }> };
  const rows = result?.results;
  if (rows && rows.length > 0) return rows[0];
  return null;
}

async function resolveCategoryId(
  env: Env,
  slugOrId: string
): Promise<{ id: string; slug: string } | null> {
  const result = (await storageQuery(
    env,
    "SELECT id, slug FROM categories WHERE id = ? OR slug = ? LIMIT 1",
    [slugOrId, slugOrId]
  )) as { results?: Array<{ id: string; slug: string }> };
  const rows = result?.results;
  if (rows && rows.length > 0) return rows[0];
  return null;
}

// ============================================================
// POST /workflow/start — Create a new workflow (or batch)
// Body: ProductSetupInput
// ============================================================

app.post("/workflow/start", async (c) => {
  try {
    const body = await c.req.json<ProductSetupInput>();

    // Validate required fields
    if (!body.domain_id || !body.category_id) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Missing required fields: domain_id, category_id",
        },
        400
      );
    }

    // Resolve slugs to actual DB IDs (frontend sends slugs, DB expects UUIDs).
    // Falls back to the original value if resolution fails (e.g. value is already an ID).
    const [resolvedDomain, resolvedCategory] = await Promise.all([
      resolveDomainId(c.env, body.domain_id),
      resolveCategoryId(c.env, body.category_id),
    ]);

    const domainId = resolvedDomain?.id ?? body.domain_id;
    const domainSlug = resolvedDomain?.slug ?? body.domain_id;
    const categoryId = resolvedCategory?.id ?? body.category_id;
    const categorySlug = resolvedCategory?.slug ?? body.category_id;

    const batchCount = body.batch_count ?? 1;

    // --- Batch mode (2+ products) ---
    if (batchCount > 1) {
      const batchOrchestrator = new BatchOrchestrator(c.env, getExecutionCtx(c));

      const batchInput: BatchInput = {
        domain_id: domainId,
        domain_slug: domainSlug,
        category_id: categoryId,
        category_slug: categorySlug,
        language: body.language ?? "en",
        niche: body.niche,  // optional — AI decides if not provided
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
    const engine = new WorkflowEngine(c.env, getExecutionCtx(c));
    const productId = generateId();
    const productName = body.name ?? body.niche ?? "Untitled";
    const slug = slugify(productName);

    // Create product record in D1
    await storageQuery(
      c.env,
      `INSERT INTO products (id, domain_id, category_id, name, slug, niche, language, status, user_input, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
      [
        productId,
        domainId,
        categoryId,
        productName,
        slug,
        body.niche,
        body.language ?? "en",
        JSON.stringify({
          domain_slug: domainSlug,
          category_slug: categorySlug,
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

    // Load prompt templates and CEO workflow config in parallel
    const [promptTemplates, ceoWorkflowConfig] = await Promise.all([
      loadPromptTemplates(c.env),
      loadCEOWorkflowConfig(c.env, categorySlug),
    ]);

    // Build product context — apply CEO recommendations as defaults
    // If user didn't specify platforms/channels, use CEO recommendations
    const userPlatforms = body.platforms ?? [];
    const userSocialChannels = body.social_channels ?? [];
    const effectivePlatforms = userPlatforms.length > 0
      ? userPlatforms
      : ceoWorkflowConfig?.recommended_platforms ?? [];
    const effectiveSocialChannels = userSocialChannels.length > 0
      ? userSocialChannels
      : ceoWorkflowConfig?.recommended_social_channels ?? [];

    const productContext: ProductContext = {
      domain_id: domainId,
      domain_slug: domainSlug,
      category_id: categoryId,
      category_slug: categorySlug,
      niche: body.niche,  // optional — AI decides if not provided
      name: body.name,
      description: body.description,
      keywords: body.keywords,
      language: body.language ?? "en",
      platforms: effectivePlatforms,
      social_channels: effectiveSocialChannels,
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
      ceoWorkflowConfig,
    };

    const { runId } = await engine.createWorkflow(productId, workflowInput);

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: runId,
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

    const engine = new WorkflowEngine(c.env, getExecutionCtx(c));
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

    const engine = new WorkflowEngine(c.env, getExecutionCtx(c));
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

    const orchestrator = new BatchOrchestrator(c.env, getExecutionCtx(c));
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

    const engine = new WorkflowEngine(c.env, getExecutionCtx(c));
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

// ============================================================
// POST /workflow/retry-from-step/:runId — Retry from a specific step (7.2)
// Re-runs only from the given step forward, using cached outputs from prior steps
// ============================================================

app.post("/workflow/retry-from-step/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing runId parameter" },
        400
      );
    }

    const body = await c.req.json<{ step_name: string }>();

    if (!body.step_name) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing step_name in request body" },
        400
      );
    }

    const engine = new WorkflowEngine(c.env, getExecutionCtx(c));

    // Get the workflow status to determine which steps to re-run
    const status = await engine.getWorkflowStatus(runId);
    if (!status) {
      return c.json<ApiResponse>(
        { success: false, error: `Workflow run ${runId} not found` },
        404
      );
    }

    // Find the step index and build the list of steps from that point forward
    const allSteps = status.steps.map((s) => s.step_name as StepName);
    const startIndex = allSteps.indexOf(body.step_name as StepName);

    if (startIndex === -1) {
      return c.json<ApiResponse>(
        { success: false, error: `Step ${body.step_name} not found in workflow` },
        400
      );
    }

    // Steps to re-run: from the specified step to the end
    const stepsToRetry = allSteps.slice(startIndex);

    // Use the existing revise mechanism with empty feedback
    const result = await engine.reviseWorkflow(
      runId,
      `Retrying from step: ${body.step_name}`,
      stepsToRetry
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        run_id: result.runId,
        retrying_from: body.step_name,
        steps_to_retry: stepsToRetry,
        status: "in_revision",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Retry-from-step failed:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

// ============================================================
// POST /workflow/batch/:batchId/retry-failed — Retry all failed
// items in a batch workflow
// ============================================================

app.post("/workflow/batch/:batchId/retry-failed", async (c) => {
  try {
    const batchId = c.req.param("batchId");

    if (!batchId) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing batchId parameter" },
        400
      );
    }

    const orchestrator = new BatchOrchestrator(c.env, getExecutionCtx(c));
    const progress = await orchestrator.getBatchProgress(batchId);

    if (!progress) {
      return c.json<ApiResponse>(
        { success: false, error: `Batch ${batchId} not found` },
        404
      );
    }

    if (progress.failed_items.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No failed items to retry" },
        400
      );
    }

    // Resume each failed product's workflow
    const engine = new WorkflowEngine(c.env, getExecutionCtx(c));
    const retryResults: Array<{ productId: string; runId: string | null; status: string }> = [];

    for (const failed of progress.failed_items) {
      // Find the run ID for this product
      const product = progress.products.find((p) => p.productId === failed.productId);
      if (!product?.runId) {
        retryResults.push({ productId: failed.productId, runId: null, status: "no_run_found" });
        continue;
      }

      try {
        const status = await engine.getWorkflowStatus(product.runId);
        if (!status) {
          retryResults.push({ productId: failed.productId, runId: product.runId, status: "run_not_found" });
          continue;
        }

        // Find failed steps and resume
        const allSteps = status.steps.map((s) => s.step_name as StepName);
        const completedSteps = status.steps
          .filter((s) => s.status === "completed")
          .map((s) => s.step_name as StepName);

        const lastCompletedIndex = completedSteps.length > 0
          ? allSteps.indexOf(completedSteps[completedSteps.length - 1])
          : -1;
        const stepsToResume = allSteps.slice(lastCompletedIndex + 1);

        if (stepsToResume.length > 0) {
          await engine.reviseWorkflow(
            product.runId,
            `Batch retry: resuming from step ${stepsToResume[0]}`,
            stepsToResume
          );
          retryResults.push({ productId: failed.productId, runId: product.runId, status: "retrying" });
        } else {
          retryResults.push({ productId: failed.productId, runId: product.runId, status: "all_steps_completed" });
        }
      } catch (retryErr) {
        const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        retryResults.push({ productId: failed.productId, runId: product.runId, status: `error: ${msg}` });
      }
    }

    return c.json<ApiResponse>({
      success: true,
      data: {
        batch_id: batchId,
        retried: retryResults.filter((r) => r.status === "retrying").length,
        total_failed: progress.failed_items.length,
        results: retryResults,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Batch retry-failed error:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

// ============================================================
// POST /workflow/resume/:runId — Resume a failed workflow from
// the last completed step (saves AI credits)
// ============================================================

app.post("/workflow/resume/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing runId parameter" },
        400
      );
    }

    const engine = new WorkflowEngine(c.env, getExecutionCtx(c));

    // Get current workflow status
    const status = await engine.getWorkflowStatus(runId);
    if (!status) {
      return c.json<ApiResponse>(
        { success: false, error: `Workflow run ${runId} not found` },
        404
      );
    }

    // Only allow resuming failed workflows
    if (status.run.status !== "failed") {
      return c.json<ApiResponse>(
        { success: false, error: `Can only resume failed workflows. Current status: ${status.run.status}` },
        400
      );
    }

    // Find the last completed step and determine which steps need to re-run
    const allSteps = status.steps.map((s) => s.step_name as StepName);
    const completedSteps = status.steps
      .filter((s) => s.status === "completed")
      .map((s) => s.step_name as StepName);

    // Steps to resume: everything after the last completed step
    const lastCompletedIndex = completedSteps.length > 0
      ? allSteps.indexOf(completedSteps[completedSteps.length - 1])
      : -1;
    const stepsToResume = allSteps.slice(lastCompletedIndex + 1);

    if (stepsToResume.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "All steps already completed — nothing to resume" },
        400
      );
    }

    // Use the existing revise mechanism to re-run from the failed step
    const result = await engine.reviseWorkflow(
      runId,
      `Resuming from step: ${stepsToResume[0]}`,
      stepsToResume
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        run_id: result.runId,
        resumed_from: stepsToResume[0],
        steps_to_run: stepsToResume,
        completed_steps: completedSteps,
        status: "in_revision",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Resume failed:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

// ============================================================
// POST /workflow/products/:productId/regenerate-images
// Delete existing images and regenerate platform-specific images
// ============================================================

app.post("/workflow/products/:productId/regenerate-images", async (c) => {
  try {
    const productId = c.req.param("productId");

    if (!productId) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing productId parameter" },
        400
      );
    }

    // 1. Get product info for context
    const productResult = (await storageQuery(
      c.env,
      `SELECT p.*, d.slug as domain_slug, cat.slug as category_slug
       FROM products p
       LEFT JOIN domains d ON d.id = p.domain_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE p.id = ?`,
      [productId]
    )) as { results?: Array<Record<string, unknown>> };

    const product = Array.isArray(productResult)
      ? productResult[0]
      : productResult?.results?.[0];

    if (!product) {
      return c.json<ApiResponse>(
        { success: false, error: `Product ${productId} not found` },
        404
      );
    }

    // 2. Get existing image_generation step output for prompts
    const stepsResult = (await storageQuery(
      c.env,
      `SELECT ws.output FROM workflow_steps ws
       JOIN workflow_runs wr ON wr.id = ws.run_id
       WHERE wr.product_id = ? AND ws.step_name = 'image_generation' AND ws.output IS NOT NULL
       ORDER BY ws.completed_at DESC LIMIT 1`,
      [productId]
    )) as { results?: Array<{ output?: string }> };

    const stepRows = Array.isArray(stepsResult)
      ? stepsResult
      : stepsResult?.results ?? [];
    const stepOutput = stepRows[0]?.output;

    let heroPrompt = `Professional product image for ${(product.name as string) ?? "product"}`;
    let heroStyle = "";

    if (stepOutput) {
      try {
        const parsed = JSON.parse(stepOutput) as Record<string, unknown>;
        const rawPrompts = (parsed.image_prompts ?? parsed.images ?? []) as Array<{
          description: string;
          style?: string;
        }>;
        if (rawPrompts[0]?.description) {
          heroPrompt = rawPrompts[0].description;
          heroStyle = rawPrompts[0].style ?? "";
        }
      } catch {
        // Use default prompt
      }
    }

    // 3. Delete existing images for this product
    await storageQuery(
      c.env,
      `DELETE FROM assets WHERE product_id = ? AND asset_type = 'image'`,
      [productId]
    );

    // 4. Determine platforms
    let platforms: string[] = [];
    try {
      const userInput = product.user_input
        ? JSON.parse(product.user_input as string) as { platforms?: string[] }
        : null;
      platforms = userInput?.platforms ?? [];
    } catch {
      // ignore
    }
    if (platforms.length === 0) {
      platforms = ["etsy", "pinterest", "instagram", "twitter", "facebook"];
    }

    // 5. Build platform-specific prompts
    const { generateAndStoreImages } = await import("./engine/service-clients");

    const platformPrompts = platforms.map((platform: string) => ({
      description: heroPrompt,
      style: heroStyle,
      platform,
    }));
    platformPrompts.push({
      description: heroPrompt,
      style: "High contrast, bold, readable at small size",
      platform: "thumbnail",
    });

    // 6. Generate images
    const assets = await generateAndStoreImages(c.env, productId, platformPrompts);

    return c.json<ApiResponse>({
      success: true,
      data: {
        product_id: productId,
        images_generated: assets.length,
        assets,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WORKFLOW] Regenerate images failed:", message);
    return c.json<ApiResponse>(
      { success: false, error: message },
      500
    );
  }
});

// ============================================================
// PROJECT BUILDER ROUTES
// ============================================================

// POST /workflow/project-builder/start — Start a new project build
app.post("/workflow/project-builder/start", async (c) => {
  try {
    const body = await c.req.json<ProjectBuildInput>();

    if (!body.idea || body.idea.trim().length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Missing required field: idea" },
        400
      );
    }

    const engine = new ProjectBuilderEngine(c.env, getExecutionCtx(c));
    const { buildId } = await engine.startBuild(body);

    return c.json<ApiResponse>({
      success: true,
      data: { build_id: buildId, status: "planning" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PROJECT-BUILDER] Start failed:", message);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// GET /workflow/project-builder/list — List all project builds
app.get("/workflow/project-builder/list", async (c) => {
  try {
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "20", 10);

    const engine = new ProjectBuilderEngine(c.env);
    const { builds, total } = await engine.listBuilds(page, pageSize);

    return c.json<ApiResponse>({
      success: true,
      data: { builds, total, page, pageSize },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// GET /workflow/project-builder/:buildId — Get build status & progress
app.get("/workflow/project-builder/:buildId", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    if (!buildId) {
      return c.json<ApiResponse>({ success: false, error: "Missing buildId" }, 400);
    }

    const engine = new ProjectBuilderEngine(c.env);
    const progress = await engine.getBuildProgress(buildId);

    if (!progress) {
      return c.json<ApiResponse>({ success: false, error: `Build ${buildId} not found` }, 404);
    }

    return c.json<ApiResponse>({ success: true, data: progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// GET /workflow/project-builder/:buildId/details — Get full build details
app.get("/workflow/project-builder/:buildId/details", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    if (!buildId) {
      return c.json<ApiResponse>({ success: false, error: "Missing buildId" }, 400);
    }

    const engine = new ProjectBuilderEngine(c.env);
    const build = await engine.getBuild(buildId);

    if (!build) {
      return c.json<ApiResponse>({ success: false, error: `Build ${buildId} not found` }, 404);
    }

    return c.json<ApiResponse>({ success: true, data: build });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// GET /workflow/project-builder/:buildId/files — Get generated files
app.get("/workflow/project-builder/:buildId/files", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    if (!buildId) {
      return c.json<ApiResponse>({ success: false, error: "Missing buildId" }, 400);
    }

    const engine = new ProjectBuilderEngine(c.env);
    const files = await engine.getBuildFiles(buildId);

    return c.json<ApiResponse>({ success: true, data: { files } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// POST /workflow/project-builder/:buildId/rebuild — Rebuild with feedback
app.post("/workflow/project-builder/:buildId/rebuild", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    if (!buildId) {
      return c.json<ApiResponse>({ success: false, error: "Missing buildId" }, 400);
    }

    const body = await c.req.json<{ feedback: string }>();
    if (!body.feedback) {
      return c.json<ApiResponse>({ success: false, error: "Missing feedback" }, 400);
    }

    const engine = new ProjectBuilderEngine(c.env, getExecutionCtx(c));
    await engine.rebuildWithFeedback(buildId, body.feedback);

    return c.json<ApiResponse>({
      success: true,
      data: { build_id: buildId, status: "building" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// POST /workflow/project-builder/:buildId/cancel — Cancel a build
app.post("/workflow/project-builder/:buildId/cancel", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    if (!buildId) {
      return c.json<ApiResponse>({ success: false, error: "Missing buildId" }, 400);
    }

    const engine = new ProjectBuilderEngine(c.env);
    await engine.cancelBuild(buildId);

    return c.json<ApiResponse>({
      success: true,
      data: { build_id: buildId, status: "cancelled" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

// DELETE /workflow/project-builder/:buildId — Delete a build
app.delete("/workflow/project-builder/:buildId", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    if (!buildId) {
      return c.json<ApiResponse>({ success: false, error: "Missing buildId" }, 400);
    }

    const engine = new ProjectBuilderEngine(c.env);
    await engine.deleteBuild(buildId);

    return c.json<ApiResponse>({ success: true, data: { deleted: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json<ApiResponse>({ success: false, error: message }, 500);
  }
});

export default app;
