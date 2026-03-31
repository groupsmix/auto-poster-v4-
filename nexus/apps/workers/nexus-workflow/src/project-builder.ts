// ============================================================
// Project Builder Engine — Multi-phase AI code generation
// Phase 1: PLAN  (CEO → Architect → Contracts → Validate)
// Phase 2: BUILD (Designer+DB → Backend+Frontend → Integrator)
// Phase 3: VALIDATE (Structural → Code Review → QA → Fixer)
// Cycles up to MAX_BUILD_CYCLES until quality >= MIN_QUALITY_SCORE
// ============================================================

import type {
  Env,
  ApiResponse,
  ProjectBuildInput,
  ProjectBuild,
  ProjectBuildStep,
  ProjectBuildProgress,
  ProjectSpec,
  ArchitectureBlueprint,
  ValidationReport,
  BuildAgentRole,
  ProjectBuildPhase,
} from "@nexus/shared";
import {
  generateId,
  now,
  MAX_BUILD_CYCLES,
  MIN_QUALITY_SCORE,
  PLAN_PHASE_STEPS,
  BUILD_PHASE_LAYERS,
  VALIDATE_PHASE_STEPS,
} from "@nexus/shared";

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

// --- Helper: call nexus-ai service binding ---

async function callAI(
  env: Env,
  taskType: string,
  prompt: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType, prompt }),
  });

  const json = (await response.json()) as ApiResponse<{
    result: string;
    model: string;
    cached: boolean;
    tokens?: number;
  }>;

  if (!json.success || !json.data) {
    throw new Error(`AI call failed: ${json.error ?? "Unknown error"}`);
  }

  return json.data;
}

// --- Helper: parse AI JSON response ---

function parseAIResponse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Try extracting from markdown code blocks
  }

  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // continue
    }
  }

  // Find balanced JSON object
  const startIdx = raw.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(raw.slice(startIdx, i + 1)) as Record<string, unknown>;
          } catch {
            break;
          }
        }
      }
    }
  }

  const preview = raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
  throw new Error(`Failed to parse AI response as JSON. Preview: ${preview}`);
}

// --- Step timeout ---
const STEP_TIMEOUT_MS = 5 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ============================================================
// ProjectBuilderEngine
// ============================================================

export class ProjectBuilderEngine {
  private env: Env;
  private ctx?: ExecutionContext;

  constructor(env: Env, ctx?: ExecutionContext) {
    this.env = env;
    this.ctx = ctx;
  }

  /**
   * Start a new project build from user idea.
   */
  async startBuild(input: ProjectBuildInput): Promise<{ buildId: string }> {
    const buildId = generateId();

    // Create the build record
    await storageQuery(
      this.env,
      `INSERT INTO project_builds (id, idea, tech_stack, features, target_user, design_style, status, current_phase, current_cycle, max_cycles, total_files, total_tokens, total_cost, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'planning', 'plan', 1, ?, 0, 0, 0, ?, ?)`,
      [
        buildId,
        input.idea,
        input.tech_stack ?? null,
        input.features ? JSON.stringify(input.features) : null,
        input.target_user ?? null,
        input.design_style ?? null,
        MAX_BUILD_CYCLES,
        now(),
        now(),
      ]
    );

    // Create step records for all phases (cycle 1)
    await this.createStepRecords(buildId, 1);

    // Run the pipeline in the background
    const pipelinePromise = this.runFullPipeline(buildId, input).catch(async (err) => {
      console.error(`[PROJECT-BUILDER] Pipeline failed for build ${buildId}:`, err);
      const message = err instanceof Error ? err.message : String(err);
      await this.updateBuild(buildId, {
        status: "failed",
        error: `Pipeline error: ${message}`,
        completed_at: now(),
      });
    });

    if (this.ctx?.waitUntil) {
      this.ctx.waitUntil(pipelinePromise);
    }

    return { buildId };
  }

  /**
   * Get the current build status and progress.
   */
  async getBuildProgress(buildId: string): Promise<ProjectBuildProgress | null> {
    const buildResult = (await storageQuery(
      this.env,
      "SELECT * FROM project_builds WHERE id = ?",
      [buildId]
    )) as { results?: ProjectBuild[] };

    const build = buildResult?.results?.[0];
    if (!build) return null;

    const stepsResult = (await storageQuery(
      this.env,
      "SELECT * FROM project_build_steps WHERE build_id = ? ORDER BY step_order",
      [buildId]
    )) as { results?: ProjectBuildStep[] };

    const steps = stepsResult?.results ?? [];

    // Count files
    const filesResult = (await storageQuery(
      this.env,
      "SELECT COUNT(*) as count FROM project_build_files WHERE build_id = ?",
      [buildId]
    )) as { results?: Array<{ count: number }> };

    const totalFiles = filesResult?.results?.[0]?.count ?? 0;

    // Build progress structure
    const planSteps = steps.filter((s) => s.phase === "plan");
    const buildSteps = steps.filter((s) => s.phase === "build");
    const validateSteps = steps.filter((s) => s.phase === "validate");

    return {
      build_id: buildId,
      status: build.status,
      current_phase: build.current_phase,
      current_cycle: build.current_cycle,
      max_cycles: build.max_cycles,
      quality_score: build.quality_score ?? undefined,
      phases: {
        plan: {
          status: this.getPhaseStatus(planSteps),
          steps: planSteps.map((s) => ({
            agent_role: s.agent_role,
            status: s.status,
            ai_model: s.ai_model ?? undefined,
            latency_ms: s.latency_ms ?? undefined,
          })),
        },
        build: {
          status: this.getPhaseStatus(buildSteps),
          layers: BUILD_PHASE_LAYERS.map((layerRoles) => ({
            agents: layerRoles.map((role) => {
              const step = buildSteps.find((s) => s.agent_role === role);
              return {
                agent_role: role,
                status: step?.status ?? "waiting",
                files_generated: undefined, // Could count per agent
              };
            }),
          })),
        },
        validate: {
          status: this.getPhaseStatus(validateSteps),
          steps: validateSteps.map((s) => ({
            agent_role: s.agent_role,
            status: s.status,
            score: s.output ? (s.output as Record<string, unknown>).score as number | undefined : undefined,
            issues_found: s.output ? (s.output as Record<string, unknown>).issues_count as number | undefined : undefined,
          })),
        },
      },
      total_files: totalFiles,
      total_tokens: build.total_tokens,
      total_cost: build.total_cost,
    };
  }

  /**
   * Get build details including spec and blueprint.
   */
  async getBuild(buildId: string): Promise<ProjectBuild | null> {
    const result = (await storageQuery(
      this.env,
      "SELECT * FROM project_builds WHERE id = ?",
      [buildId]
    )) as { results?: Record<string, unknown>[] };

    const row = result?.results?.[0];
    if (!row) return null;

    return {
      ...row,
      features: row.features ? JSON.parse(row.features as string) : undefined,
      spec: row.spec ? JSON.parse(row.spec as string) : undefined,
      blueprint: row.blueprint ? JSON.parse(row.blueprint as string) : undefined,
      validation_report: row.validation_report ? JSON.parse(row.validation_report as string) : undefined,
    } as ProjectBuild;
  }

  /**
   * List all project builds.
   */
  async listBuilds(page = 1, pageSize = 20): Promise<{ builds: ProjectBuild[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const countResult = (await storageQuery(
      this.env,
      "SELECT COUNT(*) as count FROM project_builds",
      []
    )) as { results?: Array<{ count: number }> };

    const total = countResult?.results?.[0]?.count ?? 0;

    const result = (await storageQuery(
      this.env,
      "SELECT * FROM project_builds ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [pageSize, offset]
    )) as { results?: Record<string, unknown>[] };

    const builds = (result?.results ?? []).map((row) => ({
      ...row,
      features: row.features ? JSON.parse(row.features as string) : undefined,
      spec: row.spec ? JSON.parse(row.spec as string) : undefined,
      blueprint: row.blueprint ? JSON.parse(row.blueprint as string) : undefined,
      validation_report: row.validation_report ? JSON.parse(row.validation_report as string) : undefined,
    })) as ProjectBuild[];

    return { builds, total };
  }

  /**
   * Get generated files for a build.
   */
  async getBuildFiles(buildId: string): Promise<Array<{ file_path: string; content: string; agent_role: string; language?: string; size_bytes: number }>> {
    const result = (await storageQuery(
      this.env,
      "SELECT file_path, content, agent_role, language, size_bytes FROM project_build_files WHERE build_id = ? ORDER BY file_path",
      [buildId]
    )) as { results?: Array<{ file_path: string; content: string; agent_role: string; language?: string; size_bytes: number }> };

    return result?.results ?? [];
  }

  /**
   * Cancel a running build.
   */
  async cancelBuild(buildId: string): Promise<void> {
    await this.updateBuild(buildId, { status: "cancelled", completed_at: now() });
  }

  /**
   * Delete a build and all its data.
   */
  async deleteBuild(buildId: string): Promise<void> {
    await storageQuery(this.env, "DELETE FROM project_build_files WHERE build_id = ?", [buildId]);
    await storageQuery(this.env, "DELETE FROM project_build_steps WHERE build_id = ?", [buildId]);
    await storageQuery(this.env, "DELETE FROM project_contracts WHERE build_id = ?", [buildId]);
    await storageQuery(this.env, "DELETE FROM project_builds WHERE id = ?", [buildId]);
  }

  /**
   * Rebuild with user feedback (starts a new cycle).
   */
  async rebuildWithFeedback(buildId: string, feedback: string): Promise<void> {
    const build = await this.getBuild(buildId);
    if (!build) throw new Error(`Build ${buildId} not found`);

    const newCycle = build.current_cycle + 1;
    if (newCycle > build.max_cycles) {
      throw new Error(`Maximum build cycles (${build.max_cycles}) reached`);
    }

    await this.updateBuild(buildId, {
      status: "building",
      current_phase: "build",
      current_cycle: newCycle,
    });

    await this.createStepRecords(buildId, newCycle);

    const input: ProjectBuildInput = {
      idea: build.idea,
      tech_stack: build.tech_stack ?? undefined,
      features: build.features ?? undefined,
      target_user: build.target_user ?? undefined,
      design_style: build.design_style ?? undefined,
    };

    const pipelinePromise = this.runBuildValidateCycle(buildId, input, newCycle, feedback).catch(async (err) => {
      console.error(`[PROJECT-BUILDER] Rebuild failed for ${buildId}:`, err);
      const message = err instanceof Error ? err.message : String(err);
      await this.updateBuild(buildId, {
        status: "failed",
        error: `Rebuild error: ${message}`,
        completed_at: now(),
      });
    });

    if (this.ctx?.waitUntil) {
      this.ctx.waitUntil(pipelinePromise);
    }
  }

  // ============================================================
  // PRIVATE: Pipeline execution
  // ============================================================

  /**
   * Run the full pipeline: PLAN → BUILD → VALIDATE → cycle if needed.
   */
  private async runFullPipeline(buildId: string, input: ProjectBuildInput): Promise<void> {
    // Phase 1: PLAN
    await this.updateBuild(buildId, { status: "planning", current_phase: "plan" });

    const spec = await this.runPlanPhase(buildId, input, 1);
    if (!spec) return; // cancelled or failed

    await this.updateBuild(buildId, {
      status: "plan_complete",
      spec: JSON.stringify(spec.spec),
      blueprint: JSON.stringify(spec.blueprint),
    });

    // Phase 2+3: BUILD → VALIDATE cycle
    await this.runBuildValidateCycle(buildId, input, 1);
  }

  /**
   * Run BUILD → VALIDATE, cycling up to max_cycles.
   */
  private async runBuildValidateCycle(
    buildId: string,
    input: ProjectBuildInput,
    cycle: number,
    feedback?: string
  ): Promise<void> {
    // Check cancellation
    if (await this.isCancelled(buildId)) return;

    // Load spec and blueprint from DB
    const build = await this.getBuild(buildId);
    if (!build?.spec || !build?.blueprint) {
      throw new Error("Cannot build without spec and blueprint");
    }

    // Phase 2: BUILD
    await this.updateBuild(buildId, { status: "building", current_phase: "build", current_cycle: cycle });
    await this.runBuildPhase(buildId, build.spec, build.blueprint, cycle, feedback);

    if (await this.isCancelled(buildId)) return;

    // Phase 3: VALIDATE
    await this.updateBuild(buildId, { status: "validating", current_phase: "validate" });
    const report = await this.runValidatePhase(buildId, build.spec, build.blueprint, cycle);

    if (!report) return;

    // Check quality score
    if (report.overall_score >= MIN_QUALITY_SCORE) {
      // Passed!
      await this.updateBuild(buildId, {
        status: "completed",
        quality_score: report.overall_score,
        validation_report: JSON.stringify(report),
        completed_at: now(),
      });
      console.log(`[PROJECT-BUILDER] Build ${buildId} PASSED with score ${report.overall_score}/10 on cycle ${cycle}`);
      return;
    }

    // Need fixing — cycle again if under max
    if (cycle < MAX_BUILD_CYCLES) {
      console.log(`[PROJECT-BUILDER] Build ${buildId} scored ${report.overall_score}/10 on cycle ${cycle}, running fix cycle`);

      await this.updateBuild(buildId, {
        status: "fixing",
        quality_score: report.overall_score,
        validation_report: JSON.stringify(report),
      });

      // Run fixer
      await this.runFixerStep(buildId, report, cycle);

      // Recurse into next cycle
      await this.runBuildValidateCycle(buildId, input, cycle + 1);
    } else {
      // Max cycles reached — package with quality report
      await this.updateBuild(buildId, {
        status: "completed",
        quality_score: report.overall_score,
        validation_report: JSON.stringify(report),
        completed_at: now(),
      });
      console.log(`[PROJECT-BUILDER] Build ${buildId} completed with score ${report.overall_score}/10 after ${cycle} cycles (max reached)`);
    }
  }

  // ============================================================
  // PHASE 1: PLAN
  // ============================================================

  private async runPlanPhase(
    buildId: string,
    input: ProjectBuildInput,
    cycle: number
  ): Promise<{ spec: ProjectSpec; blueprint: ArchitectureBlueprint } | null> {
    let totalTokens = 0;

    // Step 1: AI CEO — Idea Expansion → Project Spec
    const ceoPrompt = this.buildCEOPrompt(input);
    const ceoResult = await this.executeStep(buildId, "plan", "ceo", "reasoning", ceoPrompt, cycle);
    if (!ceoResult) return null;
    totalTokens += ceoResult.tokens;

    const spec = ceoResult.output as unknown as ProjectSpec;

    // Step 2: AI Architect — Architecture Blueprint
    const architectPrompt = this.buildArchitectPrompt(spec);
    const architectResult = await this.executeStep(buildId, "plan", "architect", "reasoning", architectPrompt, cycle);
    if (!architectResult) return null;
    totalTokens += architectResult.tokens;

    const blueprint = architectResult.output as unknown as ArchitectureBlueprint;

    // Step 3: Contract Generation
    const contractPrompt = this.buildContractPrompt(spec, blueprint);
    const contractResult = await this.executeStep(buildId, "plan", "contract_generator", "code", contractPrompt, cycle);
    if (!contractResult) return null;
    totalTokens += contractResult.tokens;

    // Save contracts to DB
    const contracts = contractResult.output;
    for (const [contractType, content] of Object.entries(contracts)) {
      await storageQuery(
        this.env,
        "INSERT INTO project_contracts (id, build_id, contract_type, content, cycle, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [generateId(), buildId, contractType, JSON.stringify(content), cycle, now()]
      );
    }

    // Step 4: Contract Validation
    const validationPrompt = this.buildContractValidationPrompt(contracts, spec, blueprint);
    const validationResult = await this.executeStep(buildId, "plan", "contract_validator", "reasoning", validationPrompt, cycle);
    if (!validationResult) return null;
    totalTokens += validationResult.tokens;

    await this.updateBuild(buildId, { total_tokens: totalTokens });

    return { spec, blueprint };
  }

  // ============================================================
  // PHASE 2: BUILD
  // ============================================================

  private async runBuildPhase(
    buildId: string,
    spec: ProjectSpec,
    blueprint: ArchitectureBlueprint,
    cycle: number,
    feedback?: string
  ): Promise<void> {
    // Load contracts
    const contractsResult = (await storageQuery(
      this.env,
      "SELECT contract_type, content FROM project_contracts WHERE build_id = ? AND cycle = (SELECT MAX(cycle) FROM project_contracts WHERE build_id = ?)",
      [buildId, buildId]
    )) as { results?: Array<{ contract_type: string; content: string }> };

    const contracts: Record<string, unknown> = {};
    for (const row of contractsResult?.results ?? []) {
      contracts[row.contract_type] = JSON.parse(row.content);
    }

    // Load existing files from previous cycles (for context injection)
    const existingFiles = await this.getBuildFiles(buildId);

    // Layer 1 (parallel): Designer + DB Architect
    const layer1Results = await Promise.all([
      this.executeBuildAgent(buildId, "designer", spec, blueprint, contracts, existingFiles, cycle, feedback),
      this.executeBuildAgent(buildId, "db_architect", spec, blueprint, contracts, existingFiles, cycle, feedback),
    ]);

    // Collect generated files from layer 1
    const layer1Files = await this.getBuildFiles(buildId);

    // Layer 2 (parallel): Backend Dev + Frontend Dev
    await Promise.all([
      this.executeBuildAgent(buildId, "backend_dev", spec, blueprint, contracts, layer1Files, cycle, feedback),
      this.executeBuildAgent(buildId, "frontend_dev", spec, blueprint, contracts, layer1Files, cycle, feedback),
    ]);

    // Collect all files for layer 3
    const layer2Files = await this.getBuildFiles(buildId);

    // Layer 3: Integrator
    await this.executeBuildAgent(buildId, "integrator", spec, blueprint, contracts, layer2Files, cycle, feedback);

    // Update total files count
    const allFiles = await this.getBuildFiles(buildId);
    await this.updateBuild(buildId, { total_files: allFiles.length });
  }

  private async executeBuildAgent(
    buildId: string,
    role: BuildAgentRole,
    spec: ProjectSpec,
    blueprint: ArchitectureBlueprint,
    contracts: Record<string, unknown>,
    existingFiles: Array<{ file_path: string; content: string; agent_role: string }>,
    cycle: number,
    feedback?: string
  ): Promise<void> {
    const prompt = this.buildAgentPrompt(role, spec, blueprint, contracts, existingFiles, feedback);
    const result = await this.executeStep(buildId, "build", role, "code", prompt, cycle);
    if (!result) return;

    // Parse generated files from the output
    const output = result.output;
    const files = (output.files ?? []) as Array<{ path: string; content: string; language?: string }>;

    for (const file of files) {
      const content = file.content;
      const sizeBytes = new TextEncoder().encode(content).length;

      // Upsert file (replace if same path exists in this cycle)
      await storageQuery(
        this.env,
        `INSERT INTO project_build_files (id, build_id, file_path, content, agent_role, cycle, language, size_bytes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(build_id, file_path, cycle) DO UPDATE SET content = ?, agent_role = ?, language = ?, size_bytes = ?, updated_at = ?`,
        [
          generateId(), buildId, file.path, content, role, cycle, file.language ?? null, sizeBytes, now(), now(),
          content, role, file.language ?? null, sizeBytes, now(),
        ]
      );
    }
  }

  // ============================================================
  // PHASE 3: VALIDATE
  // ============================================================

  private async runValidatePhase(
    buildId: string,
    spec: ProjectSpec,
    blueprint: ArchitectureBlueprint,
    cycle: number
  ): Promise<ValidationReport | null> {
    const files = await this.getBuildFiles(buildId);
    const fileList = files.map((f) => ({ path: f.file_path, content: f.content }));

    // Step 1: Structural Validator (automated checks)
    const structuralPrompt = this.buildStructuralValidatorPrompt(fileList, blueprint);
    const structuralResult = await this.executeStep(buildId, "validate", "structural_validator", "reasoning", structuralPrompt, cycle);
    if (!structuralResult) return null;

    // Step 2: AI Code Reviewer
    const codeReviewPrompt = this.buildCodeReviewPrompt(fileList, spec);
    const codeReviewResult = await this.executeStep(buildId, "validate", "code_reviewer", "review", codeReviewPrompt, cycle);
    if (!codeReviewResult) return null;

    // Step 3: QA Cross-Validator
    const qaPrompt = this.buildQAValidatorPrompt(fileList, blueprint, spec);
    const qaResult = await this.executeStep(buildId, "validate", "qa_validator", "reasoning", qaPrompt, cycle);
    if (!qaResult) return null;

    // Compute overall score
    const structuralScore = (structuralResult.output.score as number) ?? 5;
    const codeReviewScore = (codeReviewResult.output.score as number) ?? 5;
    const qaScore = (qaResult.output.score as number) ?? 5;
    const overallScore = Math.round(((structuralScore + codeReviewScore + qaScore) / 3) * 10) / 10;

    const report: ValidationReport = {
      structural_score: structuralScore,
      code_review_score: codeReviewScore,
      qa_score: qaScore,
      overall_score: overallScore,
      passed: overallScore >= MIN_QUALITY_SCORE,
      structural_issues: (structuralResult.output.issues ?? []) as ValidationReport["structural_issues"],
      code_review_issues: (codeReviewResult.output.issues ?? []) as ValidationReport["code_review_issues"],
      qa_issues: (qaResult.output.issues ?? []) as ValidationReport["qa_issues"],
      suggestions: (qaResult.output.suggestions ?? []) as string[],
    };

    return report;
  }

  private async runFixerStep(
    buildId: string,
    report: ValidationReport,
    cycle: number
  ): Promise<void> {
    const files = await this.getBuildFiles(buildId);
    const allIssues = [
      ...report.structural_issues,
      ...report.code_review_issues,
      ...report.qa_issues,
    ];

    if (allIssues.length === 0) return;

    const fixerPrompt = this.buildFixerPrompt(
      files.map((f) => ({ path: f.file_path, content: f.content })),
      allIssues
    );

    const result = await this.executeStep(buildId, "validate", "fixer", "code", fixerPrompt, cycle);
    if (!result) return;

    // Apply fixes
    const fixes = (result.output.fixes ?? []) as Array<{ path: string; content: string; language?: string }>;
    for (const fix of fixes) {
      const content = fix.content;
      const sizeBytes = new TextEncoder().encode(content).length;
      const nextCycle = cycle + 1;

      await storageQuery(
        this.env,
        `INSERT INTO project_build_files (id, build_id, file_path, content, agent_role, cycle, language, size_bytes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'fixer', ?, ?, ?, ?, ?)
         ON CONFLICT(build_id, file_path, cycle) DO UPDATE SET content = ?, agent_role = 'fixer', size_bytes = ?, updated_at = ?`,
        [
          generateId(), buildId, fix.path, content, nextCycle, fix.language ?? null, sizeBytes, now(), now(),
          content, sizeBytes, now(),
        ]
      );
    }
  }

  // ============================================================
  // PRIVATE: Step execution
  // ============================================================

  private async executeStep(
    buildId: string,
    phase: ProjectBuildPhase,
    agentRole: BuildAgentRole,
    taskType: string,
    prompt: string,
    cycle: number
  ): Promise<{ output: Record<string, unknown>; tokens: number } | null> {
    // Check cancellation
    if (await this.isCancelled(buildId)) return null;

    const startTime = Date.now();

    // Update step status to running
    await this.updateStepByAgent(buildId, agentRole, cycle, {
      status: "running",
      started_at: now(),
    });

    try {
      const aiResult = await withTimeout(
        callAI(this.env, taskType, prompt),
        STEP_TIMEOUT_MS,
        `${agentRole} step`
      );

      const latencyMs = Date.now() - startTime;
      const tokens = aiResult.tokens ?? 0;
      const output = parseAIResponse(aiResult.result);

      // Update step as completed
      await this.updateStepByAgent(buildId, agentRole, cycle, {
        status: "completed",
        output: JSON.stringify(output),
        ai_model: aiResult.model,
        tokens_used: tokens,
        cached: aiResult.cached ? 1 : 0,
        latency_ms: latencyMs,
        completed_at: now(),
      });

      console.log(`[PROJECT-BUILDER] ${agentRole} completed (${latencyMs}ms, ${tokens} tokens)`);

      return { output, tokens };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const latencyMs = Date.now() - startTime;

      await this.updateStepByAgent(buildId, agentRole, cycle, {
        status: "failed",
        error: message,
        latency_ms: latencyMs,
        completed_at: now(),
      });

      console.error(`[PROJECT-BUILDER] ${agentRole} failed: ${message}`);
      throw err;
    }
  }

  // ============================================================
  // PRIVATE: Prompt builders for each agent
  // ============================================================

  private buildCEOPrompt(input: ProjectBuildInput): string {
    return `You are an AI CEO / Project Lead. Your job is to deeply analyze the following project idea and produce a complete Project Specification Document (PSD).

PROJECT IDEA: "${input.idea}"
${input.tech_stack ? `PREFERRED TECH STACK: ${input.tech_stack}` : ""}
${input.features ? `REQUESTED FEATURES: ${input.features.join(", ")}` : ""}
${input.target_user ? `TARGET USER: ${input.target_user}` : ""}
${input.design_style ? `DESIGN STYLE: ${input.design_style}` : ""}

Ask yourself these questions and answer them in your analysis:
1. What problem does this solve?
2. Who is the target user?
3. What are the 5+ core features?
4. What are the must-have pages?
5. What data needs to be stored?
6. What are the user flows? (signup → login → dashboard → action)
7. What integrations are needed?
8. What's the best tech stack?

Respond with a JSON object matching this EXACT structure:
{
  "project_name": "string",
  "problem_statement": "string",
  "target_users": "string",
  "core_features": ["feature1", "feature2", ...],
  "pages": ["page1", "page2", ...],
  "data_entities": ["entity1", "entity2", ...],
  "user_flows": ["flow1", "flow2", ...],
  "tech_stack": {
    "frontend": "string",
    "backend": "string",
    "database": "string",
    "styling": "string"
  },
  "integrations": ["integration1", ...],
  "auth_flow": "string"
}`;
  }

  private buildArchitectPrompt(spec: ProjectSpec): string {
    return `You are an AI Software Architect. Given the following Project Specification, design a complete system architecture.

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

Design the FULL architecture including:
1. Database schema with ALL tables, columns, types, relationships
2. API endpoint list with request/response shapes
3. Frontend page list with component hierarchy
4. Complete file/folder structure
5. Authentication flow
6. State management approach

Respond with a JSON object matching this EXACT structure:
{
  "database_schema": {
    "tables": [
      {
        "name": "table_name",
        "columns": [
          { "name": "id", "type": "TEXT", "primary_key": true },
          { "name": "created_at", "type": "TEXT" },
          { "name": "updated_at", "type": "TEXT" },
          ...more columns
        ]
      }
    ]
  },
  "api_endpoints": [
    {
      "method": "GET|POST|PUT|DELETE",
      "path": "/api/...",
      "description": "...",
      "request_body": { ... } or null,
      "response_shape": { ... },
      "auth_required": true/false
    }
  ],
  "pages": [
    {
      "route": "/path",
      "name": "PageName",
      "layout": "main|auth|dashboard",
      "components": ["Component1", "Component2"],
      "data_requirements": ["endpoint1", "endpoint2"]
    }
  ],
  "components": [
    {
      "name": "ComponentName",
      "props": { "propName": "type" },
      "state": { "stateName": "type" },
      "events": ["onClick", "onSubmit"]
    }
  ],
  "file_structure": [
    "src/app/layout.tsx",
    "src/app/page.tsx",
    ...
  ],
  "auth_flow": "description of auth flow",
  "state_management": "description of state management approach"
}`;
  }

  private buildContractPrompt(spec: ProjectSpec, blueprint: ArchitectureBlueprint): string {
    return `You are a Contract Generator. Given the project specification and architecture blueprint, generate precise contracts that ALL build agents must follow.

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

ARCHITECTURE BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

Generate contracts for each layer. Respond with a JSON object:
{
  "database_schema": { ... exact table definitions ... },
  "api_contracts": [ ... endpoint contracts ... ],
  "component_contracts": [ ... component contracts ... ],
  "page_contracts": [ ... page contracts ... ],
  "design_tokens": {
    "colors": { "primary": "#...", "secondary": "#...", ... },
    "fonts": { "heading": "...", "body": "..." },
    "spacing": { "xs": "...", "sm": "...", "md": "...", "lg": "...", "xl": "..." },
    "shadows": { "sm": "...", "md": "...", "lg": "..." },
    "borderRadius": { "sm": "...", "md": "...", "lg": "...", "full": "..." }
  }
}

IMPORTANT: Every API endpoint must have a matching frontend call. Every database table must have matching API CRUD routes. Every frontend page must have matching API data sources. All types must be consistent.`;
  }

  private buildContractValidationPrompt(
    contracts: Record<string, unknown>,
    spec: ProjectSpec,
    blueprint: ArchitectureBlueprint
  ): string {
    return `You are a Contract Validator. Check the following contracts for completeness and consistency.

CONTRACTS:
${JSON.stringify(contracts, null, 2)}

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

ARCHITECTURE BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

Validate:
1. Every API endpoint has a matching frontend call
2. Every database table has matching API CRUD routes
3. Every frontend page has matching API data sources
4. All types are consistent across frontend and backend
5. Auth flow is complete

Respond with JSON:
{
  "valid": true/false,
  "score": 1-10,
  "issues": [
    { "file": "contracts", "severity": "error|warning|info", "message": "...", "suggested_fix": "..." }
  ],
  "suggestions": ["suggestion1", ...]
}`;
  }

  private buildAgentPrompt(
    role: BuildAgentRole,
    spec: ProjectSpec,
    blueprint: ArchitectureBlueprint,
    contracts: Record<string, unknown>,
    existingFiles: Array<{ file_path: string; content: string; agent_role: string }>,
    feedback?: string
  ): string {
    const contextFiles = existingFiles
      .slice(0, 20)
      .map((f) => `--- ${f.file_path} (by ${f.agent_role}) ---\n${f.content.slice(0, 500)}`)
      .join("\n\n");

    const feedbackNote = feedback ? `\nPREVIOUS REVIEWER FEEDBACK:\n${feedback}\n` : "";

    const rolePrompts: Record<string, string> = {
      designer: `You are an AI Designer. Generate the design system files.

Generate these files:
- tailwind.config.ts with custom theme
- src/styles/globals.css with CSS variables
- src/styles/design-tokens.ts with exported constants

Use the design tokens contract. All colors must have sufficient contrast (WCAG AA).`,

      db_architect: `You are an AI Database Architect. Generate the database layer.

Generate these files:
- migrations/001_initial.sql with all CREATE TABLE statements
- src/db/seed.sql with sample data
- src/types/database.ts with TypeScript types matching the DB schema
- src/lib/db.ts with database connection and query helpers

Every table must have: id (primary key), created_at, updated_at. Use parameterized queries.`,

      backend_dev: `You are an AI Backend Developer. Generate the API backend.

For EACH endpoint in the API contracts, generate:
- Route handler with request validation, business logic, response
- Service function with database queries
- Input validation schemas
- Error handling with proper HTTP status codes

Generate files like:
- src/api/routes/[resource].ts
- src/api/services/[resource].ts
- src/api/middleware/auth.ts
- src/api/index.ts (main entry)

Rules: validate all input, handle all errors, return exact contract response shapes, use parameterized queries, require auth on protected routes.`,

      frontend_dev: `You are an AI Frontend Developer. Generate the frontend pages and components.

For EACH page in the page contracts, generate:
- Page component with layout
- Child components
- API integration (data fetching, mutations)
- Loading, error, empty, and success states
- Form validation
- Responsive design

Generate files like:
- src/app/[page]/page.tsx
- src/components/[Component].tsx
- src/hooks/use[Resource].ts

Rules: handle loading/error/empty/success states, validate forms before submit, handle API errors, be responsive, use design tokens (no hardcoded colors/strings).`,

      integrator: `You are an AI Integrator. Connect the frontend to the backend.

Generate:
- src/lib/api-client.ts — typed fetch wrappers for every backend endpoint
- src/hooks/use[Resource].ts — React hooks for data fetching
- src/context/AuthContext.tsx — auth context/provider
- src/middleware.ts — route guards for protected pages
- src/lib/utils.ts — shared utility functions

Verify: for every frontend API call, a matching backend route exists with matching request/response types.`,
    };

    const roleInstructions = rolePrompts[role] ?? `You are an AI ${role}. Generate the required files for your role.`;

    return `${roleInstructions}

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

ARCHITECTURE BLUEPRINT (relevant parts):
Database Schema: ${JSON.stringify(blueprint.database_schema, null, 2)}
API Endpoints: ${JSON.stringify(blueprint.api_endpoints, null, 2)}
File Structure: ${JSON.stringify(blueprint.file_structure, null, 2)}

CONTRACTS:
${JSON.stringify(contracts, null, 2)}

EXISTING CODE (from other agents):
${contextFiles || "(none yet)"}
${feedbackNote}

Respond with a JSON object containing a "files" array:
{
  "files": [
    {
      "path": "src/path/to/file.ts",
      "content": "// full file content here...",
      "language": "typescript"
    },
    ...
  ]
}

Generate COMPLETE, RUNNABLE files. Include all imports, types, and exports. Follow the contracts exactly.`;
  }

  private buildStructuralValidatorPrompt(
    files: Array<{ path: string; content: string }>,
    blueprint: ArchitectureBlueprint
  ): string {
    const fileList = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");

    return `You are a Structural Validator. Check the following generated project files for structural correctness.

FILES:
${fileList}

EXPECTED FILE STRUCTURE:
${JSON.stringify(blueprint.file_structure, null, 2)}

Check the following (no AI judgment needed — just parsing and pattern matching):
1. Every import references an existing file
2. Every component referenced in pages exists as a file
3. All used packages are listed in package.json
4. Every API endpoint in frontend has a matching backend route
5. Every database table referenced in code exists in the migration
6. No TODO/FIXME/HACK comments
7. No console.log in production code
8. All files use consistent formatting

Respond with JSON:
{
  "score": 1-10,
  "issues": [
    { "file": "path/to/file", "line": 42, "severity": "error|warning|info", "message": "...", "suggested_fix": "..." }
  ],
  "issues_count": 5
}`;
  }

  private buildCodeReviewPrompt(
    files: Array<{ path: string; content: string }>,
    spec: ProjectSpec
  ): string {
    const fileList = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");

    return `You are an AI Code Reviewer. Review ALL generated code for quality, security, and correctness.

FILES:
${fileList}

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

Review checklist (enforce per file):

SECURITY:
- No hardcoded secrets or API keys
- Input validation on all user inputs
- SQL injection prevention (parameterized queries)
- XSS prevention (output encoding)
- Auth checks on protected routes

LOGIC:
- Error handling covers edge cases
- Null/undefined checks where needed
- Loop termination conditions correct
- State mutations correct

CONSISTENCY:
- Naming conventions followed
- Code style matches project conventions
- Types correct and complete (no 'any')
- Imports clean (no unused imports)

COMPLETENESS:
- All CRUD operations per contract
- All pages have loading/error/empty states
- All forms have validation

Respond with JSON:
{
  "score": 1-10,
  "issues": [
    { "file": "path/to/file", "line": 42, "severity": "error|warning|info", "message": "...", "suggested_fix": "..." }
  ],
  "issues_count": 5
}`;
  }

  private buildQAValidatorPrompt(
    files: Array<{ path: string; content: string }>,
    blueprint: ArchitectureBlueprint,
    spec: ProjectSpec
  ): string {
    const fileList = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");

    return `You are an AI QA Cross-Validator. Check that everything works together — don't look at code quality, check integration correctness.

FILES:
${fileList}

ARCHITECTURE:
${JSON.stringify(blueprint, null, 2)}

SPEC:
${JSON.stringify(spec, null, 2)}

Validate:
1. Frontend page X calls API endpoint Y with correct parameters
2. API endpoint Y queries database table Z with correct columns
3. Database table Z has the columns that the API expects
4. Response shapes from API match what frontend expects
5. Auth flow: signup creates user → login returns token → token works on protected routes
6. Navigation: every link points to an existing page
7. Forms: every form field maps to a database column

Respond with JSON:
{
  "score": 1-10,
  "issues": [
    { "file": "path/to/file", "severity": "error|warning|info", "message": "..." }
  ],
  "issues_count": 5,
  "suggestions": ["suggestion1", ...]
}`;
  }

  private buildFixerPrompt(
    files: Array<{ path: string; content: string }>,
    issues: Array<{ file: string; line?: number; severity: string; message: string; suggested_fix?: string }>
  ): string {
    const issueList = issues
      .map((i) => `- [${i.severity}] ${i.file}${i.line ? `:${i.line}` : ""}: ${i.message}${i.suggested_fix ? ` (Fix: ${i.suggested_fix})` : ""}`)
      .join("\n");

    const relevantFiles = new Set(issues.map((i) => i.file));
    const fileContents = files
      .filter((f) => relevantFiles.has(f.path))
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    return `You are an AI Fixer. Make SURGICAL, TARGETED fixes to resolve the following issues. Do NOT regenerate everything — only fix what's broken.

ISSUES TO FIX:
${issueList}

FILES WITH ISSUES:
${fileContents}

Rules:
1. Only modify files that have issues
2. Preserve all working code
3. Make the minimum change needed to fix each issue
4. Do not introduce new bugs

Respond with JSON:
{
  "fixes": [
    {
      "path": "path/to/file.ts",
      "content": "// complete fixed file content",
      "language": "typescript"
    }
  ]
}`;
  }

  // ============================================================
  // PRIVATE: Helpers
  // ============================================================

  private async updateBuild(buildId: string, fields: Record<string, unknown>): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`"${key}" = ?`);
      values.push(value);
    }

    setClauses.push('"updated_at" = ?');
    values.push(now());
    values.push(buildId);

    await storageQuery(
      this.env,
      `UPDATE project_builds SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );
  }

  private async updateStepByAgent(
    buildId: string,
    agentRole: BuildAgentRole,
    cycle: number,
    fields: Record<string, unknown>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`"${key}" = ?`);
      values.push(value);
    }

    values.push(buildId, agentRole, cycle);

    await storageQuery(
      this.env,
      `UPDATE project_build_steps SET ${setClauses.join(", ")} WHERE build_id = ? AND agent_role = ? AND cycle = ?`,
      values
    );
  }

  private async createStepRecords(buildId: string, cycle: number): Promise<void> {
    let order = 1;

    // Plan phase steps
    for (const role of PLAN_PHASE_STEPS) {
      await storageQuery(
        this.env,
        `INSERT INTO project_build_steps (id, build_id, phase, agent_role, step_order, status, cycle, tokens_used, cost, cached)
         VALUES (?, ?, 'plan', ?, ?, 'waiting', ?, 0, 0, 0)`,
        [generateId(), buildId, role, order++, cycle]
      );
    }

    // Build phase steps (flattened from layers)
    for (const layer of BUILD_PHASE_LAYERS) {
      for (const role of layer) {
        await storageQuery(
          this.env,
          `INSERT INTO project_build_steps (id, build_id, phase, agent_role, step_order, status, cycle, tokens_used, cost, cached)
           VALUES (?, ?, 'build', ?, ?, 'waiting', ?, 0, 0, 0)`,
          [generateId(), buildId, role, order++, cycle]
        );
      }
    }

    // Validate phase steps
    for (const role of VALIDATE_PHASE_STEPS) {
      await storageQuery(
        this.env,
        `INSERT INTO project_build_steps (id, build_id, phase, agent_role, step_order, status, cycle, tokens_used, cost, cached)
         VALUES (?, ?, 'validate', ?, ?, 'waiting', ?, 0, 0, 0)`,
        [generateId(), buildId, role, order++, cycle]
      );
    }
  }

  private async isCancelled(buildId: string): Promise<boolean> {
    const result = (await storageQuery(
      this.env,
      "SELECT status FROM project_builds WHERE id = ?",
      [buildId]
    )) as { results?: Array<{ status: string }> };
    return result?.results?.[0]?.status === "cancelled";
  }

  private getPhaseStatus(steps: ProjectBuildStep[]): string {
    if (steps.length === 0) return "waiting";
    if (steps.every((s) => s.status === "completed")) return "completed";
    if (steps.some((s) => s.status === "failed")) return "failed";
    if (steps.some((s) => s.status === "running")) return "running";
    return "waiting";
  }
}
