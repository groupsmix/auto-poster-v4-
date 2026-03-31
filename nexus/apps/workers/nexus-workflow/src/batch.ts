// ============================================================
// V4: Batch Workflow Orchestrator
// Creates N workflow instances from one setup form
// Each product gets: unique niche angle, own workflow, own review
// Queue runs sequentially (1 at a time for free API limits)
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";
import { generateId, slugify, now, MAX_BATCH_SIZE, RECOMMENDED_BATCH_SIZE, WORKFLOW_TIMEOUT_MS, BATCH_POLL_INTERVAL_MS, PRODUCT_STATUS, WorkflowRunStatus, StepStatus } from "@nexus/shared";
import { WorkflowEngine, type WorkflowInput, storageQuery } from "./engine";
import type { ProductContext, PromptTemplates } from "./steps";

// --- Types ---

export interface BatchInput {
  /** Domain ID for the product category */
  domain_id: string;
  domain_slug: string;
  /** Category within the domain */
  category_id: string;
  category_slug: string;
  /** Base product info */
  language: string;
  niche: string;
  name?: string;
  description?: string;
  keywords?: string;
  /** Target platforms */
  platforms: string[];
  /** Social channels (if social enabled) */
  social_channels: string[];
  /** Number of products in batch (1-10) */
  batch_count: number;
  /** Optional extra user input */
  user_input?: Record<string, unknown>;
}

export interface BatchProduct {
  productId: string;
  runId: string | null;
  nicheAngle: string;
  status: string;
}

export interface BatchProgress {
  batch_id: string;
  total: number;
  completed: number;
  failed: number;
  current_index: number;
  products: BatchProduct[];
  failed_items: Array<{ productId: string; nicheAngle: string; error?: string }>;
}

// storageQuery is imported from ./engine (single source of truth)

// --- Helper: generate unique niche angles via AI ---

async function generateNicheAngles(
  env: Env,
  baseNiche: string,
  count: number
): Promise<string[]> {
  if (count <= 1) return [baseNiche];

  const prompt = `Generate ${count} unique, specific niche angles/variations for this product concept:

Base niche: "${baseNiche}"

Requirements:
- Each angle must be distinctly different from others
- Each must be specific enough to create a unique product
- Each must target a slightly different sub-audience or use case
- Return ONLY a JSON array of strings, nothing else

Example output: ["angle 1", "angle 2", "angle 3"]`;

  try {
    const response = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskType: "research", prompt }),
    });

    const json = (await response.json()) as ApiResponse<{
      result: string;
      model: string;
      cached: boolean;
    }>;

    if (json.success && json.data) {
      try {
        const parsed = JSON.parse(json.data.result) as string[];
        if (Array.isArray(parsed) && parsed.length >= count) {
          return parsed.slice(0, count);
        }
      } catch {
        // Try extracting JSON array from response
        const match = json.data.result.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]) as string[];
          if (Array.isArray(parsed) && parsed.length >= count) {
            return parsed.slice(0, count);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[BATCH] Failed to generate niche angles via AI:", err);
  }

  // Fallback: create simple numbered variations
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? baseNiche : `${baseNiche} — Variation ${i + 1}`
  );
}

// ============================================================
// BatchOrchestrator — manages batch workflow creation
// ============================================================

export class BatchOrchestrator {
  private env: Env;
  private engine: WorkflowEngine;

  constructor(env: Env) {
    this.env = env;
    this.engine = new WorkflowEngine(env);
  }

  /**
   * Create a batch of N workflow instances from one setup form.
   * Each product gets a unique niche angle, its own workflow, and its own review.
   * Products are queued and run sequentially (1 at a time).
   */
  async createBatchWorkflow(input: BatchInput): Promise<{
    batchId: string;
    products: BatchProduct[];
  }> {
    const batchId = generateId();
    const count = Math.min(Math.max(input.batch_count, 1), MAX_BATCH_SIZE);

    if (count > RECOMMENDED_BATCH_SIZE) {
      console.warn(
        `[BATCH] Batch ${batchId} has ${count} products (recommended max: ${RECOMMENDED_BATCH_SIZE}). ` +
        `Large batches risk hitting CF Worker CPU time limits. ` +
        `Estimated wall-clock: ~${count * 45}s for ${count} products × 9 steps.`
      );
    }

    console.log(
      `[BATCH] Creating batch ${batchId} with ${count} products for niche: ${input.niche}`
    );

    // Generate unique niche angles for each product
    const nicheAngles = await generateNicheAngles(
      this.env,
      input.niche,
      count
    );

    // Load prompt templates once for all products
    const promptTemplates = await this.loadPromptTemplates();

    // Create product records in D1
    const products: BatchProduct[] = [];
    for (let i = 0; i < count; i++) {
      const productId = generateId();
      const nicheAngle = nicheAngles[i];
      const productName = input.name
        ? `${input.name} — ${nicheAngle}`
        : nicheAngle;
      const slug = slugify(productName);

      await storageQuery(
        this.env,
        `INSERT INTO products (id, domain_id, category_id, name, slug, niche, language, status, batch_id, user_input, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

        [
          productId,
          input.domain_id,
          input.category_id,
          productName,
          slug,
          nicheAngle,
          input.language,
          PRODUCT_STATUS.QUEUED,
          batchId,
          JSON.stringify({
            domain_slug: input.domain_slug,
            category_slug: input.category_slug,
            platforms: input.platforms,
            social_channels: input.social_channels,
            keywords: input.keywords,
            description: input.description,
            ...input.user_input,
          }),
          now(),
          now(),
        ]
      );

      products.push({
        productId,
        runId: null,
        nicheAngle,
        status: "queued",
      });
    }

    console.log(
      `[BATCH] Created ${count} products for batch ${batchId}`
    );

    // Start sequential execution (non-blocking)
    this.runBatchSequentially(batchId, products, input, promptTemplates).catch(
      async (err) => {
        console.error(`[BATCH] Batch ${batchId} failed:`, err);
        // Mark any queued/running products in this batch as failed
        try {
          await storageQuery(
            this.env,
            `UPDATE products SET status = ?, updated_at = ? WHERE batch_id = ? AND status IN (?, ?)`,
            [PRODUCT_STATUS.FAILED, now(), batchId, PRODUCT_STATUS.QUEUED, PRODUCT_STATUS.RUNNING]
          );
        } catch (updateErr) {
          console.error(`[BATCH] Failed to update product statuses after batch error for ${batchId}:`, updateErr);
        }
      }
    );

    return { batchId, products };
  }

  /**
   * Run batch products sequentially — one at a time to respect free API limits.
   */
  private async runBatchSequentially(
    batchId: string,
    products: BatchProduct[],
    input: BatchInput,
    promptTemplates: PromptTemplates
  ): Promise<void> {
    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      console.log(
        `[BATCH] Starting product ${i + 1}/${products.length} in batch ${batchId}: ${product.nicheAngle}`
      );

      // Build product context for this specific product
      const productContext: ProductContext = {
        domain_id: input.domain_id,
        domain_slug: input.domain_slug,
        category_id: input.category_id,
        category_slug: input.category_slug,
        niche: product.nicheAngle,
        name: input.name
          ? `${input.name} — ${product.nicheAngle}`
          : product.nicheAngle,
        description: input.description,
        keywords: input.keywords,
        language: input.language,
        platforms: input.platforms,
        social_channels: input.social_channels,
        user_input: input.user_input,
      };

      const workflowInput: WorkflowInput = {
        productId: product.productId,
        product: productContext,
        promptTemplates,
      };

      try {
        // Create workflow for this product (runs the full 9-step pipeline)
        const { runId } = await this.engine.createWorkflow(
          product.productId,
          workflowInput
        );

        product.runId = runId;
        product.status = "running";

        // Wait for this workflow to complete before starting next
        await this.waitForWorkflowCompletion(runId);

        product.status = "completed";
        console.log(
          `[BATCH] Product ${i + 1}/${products.length} completed in batch ${batchId}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        product.status = "failed";
        console.error(
          `[BATCH] Product ${i + 1}/${products.length} failed in batch ${batchId}: ${message}`
        );
        // Continue with next product even if one fails
      }
    }

    console.log(`[BATCH] Batch ${batchId} finished. All products processed.`);
  }

  /**
   * Wait for a workflow to complete (polling D1 status).
   */
  private async waitForWorkflowCompletion(
    runId: string,
    timeoutMs: number = WORKFLOW_TIMEOUT_MS,
    pollIntervalMs: number = BATCH_POLL_INTERVAL_MS
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = (await storageQuery(
        this.env,
        `SELECT status FROM workflow_runs WHERE id = ?`,
        [runId]
      )) as { results?: Array<{ status: string }> };

      const status = result?.results?.[0]?.status;

      if (
        status === WorkflowRunStatus.COMPLETED ||
        status === WorkflowRunStatus.PENDING_REVIEW ||
        status === WorkflowRunStatus.FAILED ||
        status === WorkflowRunStatus.CANCELLED
      ) {
        return;
      }

      // Sleep before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    console.warn(`[BATCH] Workflow ${runId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Get batch progress — total, completed, current index, per-product status.
   */
  async getBatchProgress(batchId: string): Promise<BatchProgress | null> {
    // Single JOIN query instead of N+1 individual queries (8.1)
    const joinResult = (await storageQuery(
      this.env,
      `SELECT p.id, p.name, p.niche, p.status as product_status,
              wr.id as run_id, wr.status as run_status
       FROM products p
       LEFT JOIN workflow_runs wr ON wr.product_id = p.id
       WHERE p.batch_id = ?
       ORDER BY p.created_at ASC`,
      [batchId]
    )) as { results?: Array<Record<string, string | null>> };

    const rows = joinResult?.results;
    if (!rows || rows.length === 0) return null;

    // De-duplicate: keep the latest run per product (last row wins due to JOIN)
    const seen = new Map<string, Record<string, string | null>>();
    for (const row of rows) {
      const pid = row.id as string;
      // If we already have a row for this product with a run, only replace if this one also has a run
      if (!seen.has(pid) || row.run_id) {
        seen.set(pid, row);
      }
    }

    const products = Array.from(seen.values());
    const batchProducts: BatchProduct[] = [];
    let completedCount = 0;
    let currentIndex = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const status = p.run_status ?? p.product_status ?? "queued";

      batchProducts.push({
        productId: p.id as string,
        runId: p.run_id ?? null,
        nicheAngle: (p.niche as string) ?? "",
        status,
      });

      if (
        status === WorkflowRunStatus.COMPLETED ||
        status === WorkflowRunStatus.PENDING_REVIEW ||
        status === WorkflowRunStatus.APPROVED ||
        status === WorkflowRunStatus.PUBLISHED
      ) {
        completedCount++;
      }

      if (status === WorkflowRunStatus.RUNNING) {
        currentIndex = i;
      }
    }

    // If no product is running, current is the first non-completed
    if (currentIndex === 0 && completedCount < products.length) {
      for (let i = 0; i < batchProducts.length; i++) {
          if (
            batchProducts[i].status !== WorkflowRunStatus.COMPLETED &&
            batchProducts[i].status !== WorkflowRunStatus.PENDING_REVIEW &&
            batchProducts[i].status !== WorkflowRunStatus.APPROVED &&
            batchProducts[i].status !== WorkflowRunStatus.PUBLISHED
          ) {
          currentIndex = i;
          break;
        }
      }
    }

    // Collect failed items with details
    const failedItems = batchProducts
      .filter(
        (p) =>
          p.status === WorkflowRunStatus.FAILED ||
          p.status === "failed"
      )
      .map((p) => ({
        productId: p.productId,
        nicheAngle: p.nicheAngle,
      }));

    return {
      batch_id: batchId,
      total: products.length,
      completed: completedCount,
      failed: failedItems.length,
      current_index: currentIndex,
      products: batchProducts,
      failed_items: failedItems,
    };
  }

  /**
   * Load prompt templates from KV via nexus-storage.
   */
  private async loadPromptTemplates(): Promise<PromptTemplates> {
    const templates: PromptTemplates = {};

    try {
      const masterResp = await this.env.NEXUS_STORAGE.fetch(
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
      console.warn("[BATCH] Failed to load master prompt from KV");
    }

    try {
      const roleNames = ["researcher", "copywriter", "seo", "reviewer"];
      const roles: Record<string, string> = {};
      for (const role of roleNames) {
        const resp = await this.env.NEXUS_STORAGE.fetch(
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
      console.warn("[BATCH] Failed to load role prompts from KV");
    }

    return templates;
  }
}
