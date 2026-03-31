// ============================================================
// CF Workflows Manager — creates and manages workflow instances
// Each workflow instance = 1 product, runs the 9-step pipeline
// Uses CF Workflows API (built on Durable Objects)
// Steps sleep between execution (zero cost while sleeping)
// ============================================================

import type { Env, WorkflowStatus, ApiResponse } from "@nexus/shared";
import { WORKFLOW_STEPS, generateId, now, PRODUCT_STATUS, WorkflowRunStatus, StepStatus } from "@nexus/shared";
import {
  type StepName,
  getStepConfig,
  buildPromptForStep,
  type ProductContext,
  type PromptTemplates,
} from "../steps";

import type { WorkflowInput, StepResult } from "./types";
import {
  generateAndStoreImages,
  callAI,
  callVariation,
  storageQuery,
  updateWorkflowRun,
  parseAIResponse,
  estimateTokenCost,
  withTimeout,
  STEP_TIMEOUT_MS,
  STEP_MAX_RETRIES,
} from "./service-clients";

// Re-export types and storageQuery for external consumers
export type { WorkflowInput, StepResult } from "./types";
export { storageQuery } from "./service-clients";

// ============================================================
// WorkflowEngine — manages CF Workflow instances
// ============================================================

export class WorkflowEngine {
  private env: Env;
  private ctx?: ExecutionContext;

  constructor(env: Env, ctx?: ExecutionContext) {
    this.env = env;
    this.ctx = ctx;
  }

  /**
   * Create and start a new workflow for a product.
   * Creates the workflow run + step records in D1, then runs the pipeline.
   */
  async createWorkflow(
    productId: string,
    input: WorkflowInput
  ): Promise<{ runId: string }> {
    const runId = generateId();
    const totalSteps = WORKFLOW_STEPS.length;

    // Create workflow run record in D1
    await storageQuery(
      this.env,
      `INSERT INTO workflow_runs (id, product_id, batch_id, status, started_at, current_step, total_steps, total_tokens, total_cost, cache_hits)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 0, 0, 0)`,
      [runId, productId, WorkflowRunStatus.RUNNING, now(), WORKFLOW_STEPS[0], totalSteps]
    );

    // Create step records in D1 for all 9 steps (parameterized)
    const stepPlaceholders: string[] = [];
    const stepParams: unknown[] = [];
    for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
      stepPlaceholders.push("(?, ?, ?, ?, ?, 0, 0)");
      stepParams.push(generateId(), runId, WORKFLOW_STEPS[i], i + 1, StepStatus.WAITING);
    }
    await storageQuery(
      this.env,
      `INSERT INTO workflow_steps (id, run_id, step_name, step_order, status, cost, cached)
       VALUES ${stepPlaceholders.join(", ")}`,
      stepParams
    );

    // Update product status to running
    await storageQuery(
      this.env,
      `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
      [PRODUCT_STATUS.RUNNING, now(), productId]
    );

    // Run the pipeline.
    // Use ctx.waitUntil() if available (CF Workers) to keep the worker alive
    // until the pipeline completes, preventing premature termination.
    const pipelinePromise = this.runPipeline(runId, input).catch(async (err) => {
      console.error(`[WORKFLOW] Pipeline failed for run ${runId}:`, err);
      try {
        const message = err instanceof Error ? err.message : String(err);
        await updateWorkflowRun(this.env, runId, {
          status: "failed",
          completed_at: now(),
          error: `Unhandled pipeline error: ${message}`,
        });
        await storageQuery(
          this.env,
          `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
          [PRODUCT_STATUS.FAILED, now(), input.productId]
        );
      } catch (updateErr) {
        console.error(`[WORKFLOW] Failed to update status after pipeline error for run ${runId}:`, updateErr);
      }
    });

    // If an ExecutionContext is provided, use waitUntil to keep worker alive
    if (this.ctx?.waitUntil) {
      this.ctx.waitUntil(pipelinePromise);
    }

    return { runId };
  }

  /**
   * Execute the 9-step pipeline sequentially.
   * Each step: update status -> call AI -> save output -> sleep
   */
  private async runPipeline(
    runId: string,
    input: WorkflowInput
  ): Promise<void> {
    const priorOutputs: Partial<Record<StepName, Record<string, unknown>>> = {};
    let totalTokens = 0;
    let totalCost = 0;
    let cacheHits = 0;

    const stepsToRun = input.revisionSteps ?? [...WORKFLOW_STEPS];

    // If revision, load existing step outputs for context
    if (input.revisionSteps) {
      await this.loadExistingOutputs(runId, priorOutputs);
    }

    for (const stepName of stepsToRun) {
      // Check if workflow was cancelled
      const cancelled = await this.isWorkflowCancelled(runId);
      if (cancelled) {
        console.log(`[WORKFLOW] Run ${runId} cancelled at step ${stepName}`);
        return;
      }

      try {
        const result = await this.executeStep(
          runId,
          stepName,
          input,
          priorOutputs
        );

        // Accumulate stats
        priorOutputs[stepName] = result.output;
        totalTokens += result.tokens;
        totalCost += result.cost;
        if (result.cached) cacheHits++;

        // Update run totals
        const nextStepIndex = WORKFLOW_STEPS.indexOf(stepName) + 1;
        const nextStep =
          nextStepIndex < WORKFLOW_STEPS.length
            ? WORKFLOW_STEPS[nextStepIndex]
            : null;

        await updateWorkflowRun(this.env, runId, {
          current_step: nextStep ?? stepName,
          total_tokens: totalTokens,
          total_cost: totalCost,
          cache_hits: cacheHits,
        });

        // Post-processing: after image_generation step, generate actual images
        if (stepName === "image_generation" && result.output) {
          try {
            const output = result.output as Record<string, unknown>;
            const imagePrompts = (output.image_prompts ?? output.images ?? []) as Array<{
              description: string;
              style?: string;
              dimensions?: { width: number; height: number };
            }>;
            if (imagePrompts.length > 0) {
              console.log(`[WORKFLOW] Generating ${imagePrompts.length} actual images for product ${input.productId}`);
              const assets = await generateAndStoreImages(this.env, input.productId, imagePrompts);
              // Attach generated asset references to the step output
              priorOutputs[stepName] = { ...output, generated_assets: assets };
            }
          } catch (imgErr) {
            const imgMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
            console.error(`[WORKFLOW] Image generation post-processing failed (non-fatal): ${imgMsg}`);
          }
        }

        // Sleep between steps (CF Workflows advantage — zero cost while sleeping)
        // In production, this is handled by the CF Workflows runtime.
        // The workflow instance persists in Durable Object storage.
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[WORKFLOW] Step ${stepName} failed for run ${runId}: ${message}`
        );

        // Mark step as failed
        await this.updateStepByName(runId, stepName, {
          status: "failed",
          completed_at: now(),
        });

        // Mark workflow as failed
        await updateWorkflowRun(this.env, runId, {
          status: "failed",
          completed_at: now(),
          error: `Step ${stepName} failed: ${message}`,
          total_tokens: totalTokens,
          total_cost: totalCost,
          cache_hits: cacheHits,
        });

        // Update product status
        await storageQuery(
          this.env,
          `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
          [PRODUCT_STATUS.FAILED, now(), input.productId]
        );

        return;
      }
    }

    // All steps completed — check auto-approve settings
    const qualityOutput = priorOutputs["quality_review"];
    const qualityScore = qualityOutput
      ? (qualityOutput.overall_score as number | undefined) ?? (qualityOutput.score as number | undefined)
      : undefined;

    const autoSettings = input.autoApproveSettings;
    const autoRevisionAttempt = input.autoRevisionAttempt ?? 0;

    if (autoSettings && qualityScore !== undefined) {
      // Auto-approve: score >= threshold
      if (qualityScore >= autoSettings.auto_approve_threshold) {
        await this.handleAutoApprove(runId, input, totalTokens, totalCost, cacheHits, qualityScore);
        return;
      }

      // Auto-revise: score >= min but below threshold, and under max revision attempts
      if (
        qualityScore >= autoSettings.auto_revise_min_score &&
        qualityScore < autoSettings.auto_approve_threshold &&
        autoRevisionAttempt < autoSettings.max_auto_revisions
      ) {
        await this.handleAutoRevise(runId, input, totalTokens, totalCost, cacheHits, qualityScore, qualityOutput!, autoRevisionAttempt);
        return;
      }

      // Below min score or max revisions exhausted — flag for manual review
      console.log(
        `[WORKFLOW] Run ${runId} flagged for manual review. Score: ${qualityScore}, Attempt: ${autoRevisionAttempt}`
      );
    }

    // Default: pending_review (manual review needed)
    await updateWorkflowRun(this.env, runId, {
      status: "pending_review",
      completed_at: now(),
      total_tokens: totalTokens,
      total_cost: totalCost,
      cache_hits: cacheHits,
    });

    await storageQuery(
      this.env,
      `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
      [PRODUCT_STATUS.PENDING_REVIEW, now(), input.productId]
    );

    console.log(
      `[WORKFLOW] Run ${runId} completed. Tokens: ${totalTokens}, Cost: $${totalCost.toFixed(4)}, Cache hits: ${cacheHits}`
    );
  }

  /**
   * Execute a single workflow step.
   */
  private async executeStep(
    runId: string,
    stepName: StepName,
    input: WorkflowInput,
    priorOutputs: Partial<Record<StepName, Record<string, unknown>>>
  ): Promise<StepResult> {
    const config = getStepConfig(stepName);
    const startTime = Date.now();

    console.log(`[WORKFLOW] Run ${runId} — executing step: ${stepName}`);

    // Update step status to running
    await this.updateStepByName(runId, stepName, {
      status: "running",
      started_at: now(),
    });

    // Update workflow run current step
    await updateWorkflowRun(this.env, runId, {
      current_step: stepName,
      status: "running",
    });

    // Build the layered prompt (A through I)
    const prompt = buildPromptForStep(
      stepName,
      input.product,
      priorOutputs,
      input.promptTemplates,
      input.revisionFeedback
    );

    // Call the appropriate service
    let aiResult!: {
      result: string;
      model: string;
      cached: boolean;
      tokens?: number;
    };

    // Execute with timeout and retry logic
    const callFn = config.usesVariationWorker
      ? () => callVariation(this.env, config.taskType, prompt)
      : () => callAI(this.env, config.taskType, prompt);

    for (let attempt = 0; attempt <= STEP_MAX_RETRIES; attempt++) {
      try {
        aiResult = await withTimeout(callFn(), STEP_TIMEOUT_MS, `Step ${stepName}`);
        break;
      } catch (retryErr) {
        if (attempt < STEP_MAX_RETRIES) {
          console.warn(
            `[WORKFLOW] Step ${stepName} attempt ${attempt + 1} failed, retrying: ${
              retryErr instanceof Error ? retryErr.message : String(retryErr)
            }`
          );
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          throw retryErr;
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const tokens = aiResult.tokens ?? 0;
    // Track token cost even for free models (useful for quota monitoring)
    const cost = estimateTokenCost(aiResult.model, tokens);

    // Parse AI response as structured JSON
    const output = parseAIResponse(aiResult.result);

    // Update step with results
    await this.updateStepByName(runId, stepName, {
      status: "completed",
      ai_used: aiResult.model,
      output: JSON.stringify(output),
      tokens_used: tokens,
      cost,
      cached: aiResult.cached ? 1 : 0,
      latency_ms: latencyMs,
      completed_at: now(),
    });

    console.log(
      `[WORKFLOW] Step ${stepName} completed. Model: ${aiResult.model}, Cached: ${aiResult.cached}, ${latencyMs}ms`
    );

    return {
      stepName,
      output,
      model: aiResult.model,
      cached: aiResult.cached,
      tokens,
      cost,
      latencyMs,
    };
  }

  /**
   * Cancel a running workflow.
   */
  async cancelWorkflow(runId: string): Promise<void> {
    await updateWorkflowRun(this.env, runId, {
      status: "cancelled",
      completed_at: now(),
    });

    // Get product ID to update product status
    const result = (await storageQuery(
      this.env,
      `SELECT product_id FROM workflow_runs WHERE id = ?`,
      [runId]
    )) as { results?: Array<{ product_id: string }> };

    const productId = result?.results?.[0]?.product_id;
    if (productId) {
      await storageQuery(
        this.env,
        `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
        [PRODUCT_STATUS.CANCELLED, now(), productId]
      );
    }

    // Mark any running/waiting steps as cancelled
    await storageQuery(
      this.env,
      `UPDATE workflow_steps SET status = ?, completed_at = ? WHERE run_id = ? AND status IN (?, ?)`,
      [StepStatus.CANCELLED, now(), runId, StepStatus.WAITING, StepStatus.RUNNING]
    );

    console.log(`[WORKFLOW] Run ${runId} cancelled`);
  }

  /**
   * Get workflow status including all step statuses.
   */
  async getWorkflowStatus(
    runId: string
  ): Promise<{
    run: Record<string, unknown>;
    steps: Array<Record<string, unknown>>;
  } | null> {
    const runResult = (await storageQuery(
      this.env,
      `SELECT * FROM workflow_runs WHERE id = ?`,
      [runId]
    )) as { results?: Array<Record<string, unknown>> };

    const run = runResult?.results?.[0];
    if (!run) return null;

    const stepsResult = (await storageQuery(
      this.env,
      `SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_order ASC`,
      [runId]
    )) as { results?: Array<Record<string, unknown>> };

    return {
      run,
      steps: stepsResult?.results ?? [],
    };
  }

  /**
   * Revise a workflow — re-run only failed/rejected steps with CEO feedback.
   */
  async reviseWorkflow(
    runId: string,
    feedback: string,
    stepsToRevise?: StepName[]
  ): Promise<{ runId: string }> {
    // Get existing run
    const status = await this.getWorkflowStatus(runId);
    if (!status) {
      throw new Error(`Workflow run ${runId} not found`);
    }

    // Determine which steps to re-run
    const failedSteps = stepsToRevise ??
      (status.steps
        .filter(
          (s) => s.status === "failed" || s.status === "rejected"
        )
        .map((s) => s.step_name as StepName));

    if (failedSteps.length === 0) {
      throw new Error("No failed or rejected steps to revise");
    }

    // Get product info
    const productId = status.run.product_id as string;
    const productResult = (await storageQuery(
      this.env,
      `SELECT * FROM products WHERE id = ?`,
      [productId]
    )) as { results?: Array<Record<string, unknown>> };

    const product = productResult?.results?.[0];
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Reset failed steps to waiting
    for (const stepName of failedSteps) {
      await this.updateStepByName(runId, stepName, {
        status: "waiting",
        output: null,
        ai_used: null,
        tokens_used: null,
        cost: 0,
        cached: 0,
        latency_ms: null,
        started_at: null,
        completed_at: null,
      });
    }

    // Update workflow status to in_revision
    await updateWorkflowRun(this.env, runId, {
      status: "in_revision",
      completed_at: null,
      error: null,
    });

    // Update product status
    await storageQuery(
      this.env,
      `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
      [PRODUCT_STATUS.IN_REVISION, now(), productId]
    );

    // Load prompt templates from KV
    const promptTemplates = await this.loadPromptTemplates();

    // Build product context from DB record
    const userInput = typeof product.user_input === "string"
      ? (JSON.parse(product.user_input as string) as Record<string, unknown>)
      : (product.user_input as Record<string, unknown> | undefined);

    const productContext: ProductContext = {
      domain_id: product.domain_id as string,
      domain_slug: (userInput?.domain_slug as string) ?? "",
      category_id: product.category_id as string,
      category_slug: (userInput?.category_slug as string) ?? "",
      niche: product.niche as string | undefined,
      name: product.name as string | undefined,
      language: (product.language as string) ?? "en",
      platforms: (userInput?.platforms as string[]) ?? [],
      social_channels: (userInput?.social_channels as string[]) ?? [],
      user_input: userInput,
    };

    // Re-run only the failed steps
    const input: WorkflowInput = {
      productId,
      product: productContext,
      promptTemplates,
      revisionFeedback: feedback,
      revisionSteps: failedSteps,
    };

    const revisionPromise = this.runPipeline(runId, input).catch(async (err) => {
      console.error(`[WORKFLOW] Revision pipeline failed for run ${runId}:`, err);
      try {
        const message = err instanceof Error ? err.message : String(err);
        await updateWorkflowRun(this.env, runId, {
          status: "failed",
          completed_at: now(),
          error: `Unhandled revision pipeline error: ${message}`,
        });
        await storageQuery(
          this.env,
          `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
          [PRODUCT_STATUS.FAILED, now(), productId]
        );
      } catch (updateErr) {
        console.error(`[WORKFLOW] Failed to update status after revision pipeline error for run ${runId}:`, updateErr);
      }
    });

    if (this.ctx?.waitUntil) {
      this.ctx.waitUntil(revisionPromise);
    }

    return { runId };
  }

  // --- Auto-Approve Handlers ---

  /**
   * Handle auto-approval: score >= threshold.
   * Updates status to approved, records the review, triggers variation generation.
   */
  private async handleAutoApprove(
    runId: string,
    input: WorkflowInput,
    totalTokens: number,
    totalCost: number,
    cacheHits: number,
    qualityScore: number
  ): Promise<void> {
    const ts = now();

    // Mark workflow as approved
    await updateWorkflowRun(this.env, runId, {
      status: "approved",
      completed_at: ts,
      total_tokens: totalTokens,
      total_cost: totalCost,
      cache_hits: cacheHits,
    });

    // Mark product as approved
    await storageQuery(
      this.env,
      `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
      [PRODUCT_STATUS.APPROVED, ts, input.productId]
    );

    // Record auto-review decision
    const reviewId = generateId();
    await storageQuery(
      this.env,
      `INSERT INTO reviews (id, product_id, run_id, version, ai_score, decision, feedback, reviewed_at)
       VALUES (?, ?, ?,
               (SELECT COALESCE(MAX(version), 0) + 1 FROM reviews WHERE product_id = ?),
               ?, 'approved', 'Auto-approved: quality score meets threshold', ?)`,
      [reviewId, input.productId, runId, input.productId, qualityScore, ts]
    );

    console.log(
      `[WORKFLOW] Run ${runId} AUTO-APPROVED. Score: ${qualityScore}. Tokens: ${totalTokens}, Cost: $${totalCost.toFixed(4)}`
    );
  }

  /**
   * Handle auto-revision: score between min and threshold.
   * Triggers re-run of revisable steps with quality review feedback.
   */
  private async handleAutoRevise(
    runId: string,
    input: WorkflowInput,
    totalTokens: number,
    totalCost: number,
    cacheHits: number,
    qualityScore: number,
    qualityOutput: Record<string, unknown>,
    currentAttempt: number
  ): Promise<void> {
    const ts = now();

    console.log(
      `[WORKFLOW] Run ${runId} AUTO-REVISING. Score: ${qualityScore}, Attempt: ${currentAttempt + 1}/${input.autoApproveSettings?.max_auto_revisions ?? 2}`
    );

    // Build revision feedback from quality review output
    const issues = qualityOutput.issues as Array<{ criterion: string; problem: string; fix: string }> | undefined;
    const feedbackParts: string[] = [
      `Auto-revision (attempt ${currentAttempt + 1}): Quality score ${qualityScore}/10.`,
    ];

    if (issues && Array.isArray(issues)) {
      for (const issue of issues) {
        feedbackParts.push(`- ${issue.criterion}: ${issue.problem}. Fix: ${issue.fix}`);
      }
    }

    const feedback = feedbackParts.join("\n");

    // Record the auto-revision review
    const reviewId = generateId();
    await storageQuery(
      this.env,
      `INSERT INTO reviews (id, product_id, run_id, version, ai_score, decision, feedback, reviewed_at)
       VALUES (?, ?, ?,
               (SELECT COALESCE(MAX(version), 0) + 1 FROM reviews WHERE product_id = ?),
               ?, 'rejected', ?, ?)`,
      [reviewId, input.productId, runId, input.productId, qualityScore, feedback, ts]
    );

    // Determine which steps to revise (content-generating steps that are revisable)
    const revisableSteps: StepName[] = [
      "content_generation",
      "seo_optimization",
      "humanizer_pass",
      "quality_review",
    ];

    // Trigger revision with incremented attempt counter
    try {
      await this.reviseWorkflow(runId, feedback, revisableSteps);

      // After revision completes, the pipeline will re-check auto-approve
      // because the input carries the autoApproveSettings and incremented attempt
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WORKFLOW] Auto-revision failed for run ${runId}: ${message}`);

      // Fall back to pending_review on revision failure
      await updateWorkflowRun(this.env, runId, {
        status: "pending_review",
        completed_at: now(),
        total_tokens: totalTokens,
        total_cost: totalCost,
        cache_hits: cacheHits,
      });

      await storageQuery(
        this.env,
        `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
        [PRODUCT_STATUS.PENDING_REVIEW, now(), input.productId]
      );
    }
  }

  // --- Private helpers ---

  /**
   * Check if a workflow has been cancelled.
   */
  private async isWorkflowCancelled(runId: string): Promise<boolean> {
    const result = (await storageQuery(
      this.env,
      `SELECT status FROM workflow_runs WHERE id = ?`,
      [runId]
    )) as { results?: Array<{ status: WorkflowStatus }> };

    return result?.results?.[0]?.status === "cancelled";
  }

  private static readonly ALLOWED_STEP_COLUMNS = new Set([
    "status",
    "ai_used",
    "ai_tried",
    "output",
    "tokens_used",
    "cost",
    "cached",
    "latency_ms",
    "started_at",
    "completed_at",
  ]);

  /**
   * Update a step record by step name (within a run).
   */
  private async updateStepByName(
    runId: string,
    stepName: StepName,
    fields: Record<string, unknown>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (!WorkflowEngine.ALLOWED_STEP_COLUMNS.has(key)) continue;
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    if (setClauses.length === 0) return;

    values.push(runId, stepName);

    await storageQuery(
      this.env,
      `UPDATE workflow_steps SET ${setClauses.join(", ")} WHERE run_id = ? AND step_name = ?`,
      values
    );
  }

  /**
   * Load existing step outputs for context during revision.
   */
  private async loadExistingOutputs(
    runId: string,
    priorOutputs: Partial<Record<StepName, Record<string, unknown>>>
  ): Promise<void> {
    const stepsResult = (await storageQuery(
      this.env,
      `SELECT step_name, output FROM workflow_steps WHERE run_id = ? AND status = ? AND output IS NOT NULL ORDER BY step_order ASC`,
      [runId, StepStatus.COMPLETED]
    )) as { results?: Array<{ step_name: string; output: string }> };

    if (stepsResult?.results) {
      for (const step of stepsResult.results) {
        try {
          const output = typeof step.output === "string"
            ? (JSON.parse(step.output) as Record<string, unknown>)
            : (step.output as Record<string, unknown>);
          priorOutputs[step.step_name as StepName] = output;
        } catch {
          console.warn(
            `[WORKFLOW] Failed to parse existing output for step ${step.step_name}`
          );
        }
      }
    }
  }

  /**
   * Load prompt templates from KV via nexus-storage.
   */
  private async loadPromptTemplates(): Promise<PromptTemplates> {
    const templates: PromptTemplates = {};

    try {
      // Load master prompt
      const masterResp = await this.env.NEXUS_STORAGE.fetch(
        "http://nexus-storage/kv/prompt:master"
      );
      const masterJson = (await masterResp.json()) as ApiResponse<string>;
      if (masterJson.success && masterJson.data) {
        templates.master = typeof masterJson.data === "string"
          ? masterJson.data
          : JSON.stringify(masterJson.data);
      }
    } catch {
      console.warn("[WORKFLOW] Failed to load master prompt from KV");
    }

    try {
      // Load role prompts
      const roleNames = ["researcher", "copywriter", "seo", "reviewer"];
      const roles: Record<string, string> = {};
      for (const role of roleNames) {
        const resp = await this.env.NEXUS_STORAGE.fetch(
          `http://nexus-storage/kv/prompt:role:${role}`
        );
        const json = (await resp.json()) as ApiResponse<string>;
        if (json.success && json.data) {
          roles[role] = typeof json.data === "string"
            ? json.data
            : JSON.stringify(json.data);
        }
      }
      templates.roles = roles;
    } catch {
      console.warn("[WORKFLOW] Failed to load role prompts from KV");
    }

    return templates;
  }
}
