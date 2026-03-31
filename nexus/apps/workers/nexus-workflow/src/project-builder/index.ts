// ============================================================
// Project Builder Engine — Multi-phase AI code generation
// Phase 1: PLAN  (CEO → Architect → Contracts → Validate)
// Phase 2: BUILD (Designer+DB → Backend+Frontend → Integrator)
// Phase 3: VALIDATE (Structural → Code Review → QA → Fixer)
// Cycles up to MAX_BUILD_CYCLES until quality >= MIN_QUALITY_SCORE
// ============================================================

import type {
  Env,
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

import {
  storageQuery,
  callAI,
  parseAIResponse,
  withTimeout,
  STEP_TIMEOUT_MS,
  updateBuild,
  updateStepByAgent,
  isCancelled,
} from "./helpers";

import {
  buildCEOPrompt,
  buildArchitectPrompt,
  buildContractPrompt,
  buildContractValidationPrompt,
  buildAgentPrompt,
  buildStructuralValidatorPrompt,
  buildCodeReviewPrompt,
  buildQAValidatorPrompt,
  buildFixerPrompt,
} from "./prompts";

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
      await updateBuild(this.env, buildId, {
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
    await updateBuild(this.env, buildId, { status: "cancelled", completed_at: now() });
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

    await updateBuild(this.env, buildId, {
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
      await updateBuild(this.env, buildId, {
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
    await updateBuild(this.env, buildId, { status: "planning", current_phase: "plan" });

    const spec = await this.runPlanPhase(buildId, input, 1);
    if (!spec) return; // cancelled or failed

    await updateBuild(this.env, buildId, {
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
    if (await isCancelled(this.env, buildId)) return;

    // Load spec and blueprint from DB
    const build = await this.getBuild(buildId);
    if (!build?.spec || !build?.blueprint) {
      throw new Error("Cannot build without spec and blueprint");
    }

    // Phase 2: BUILD
    await updateBuild(this.env, buildId, { status: "building", current_phase: "build", current_cycle: cycle });
    await this.runBuildPhase(buildId, build.spec, build.blueprint, cycle, feedback);

    if (await isCancelled(this.env, buildId)) return;

    // Phase 3: VALIDATE
    await updateBuild(this.env, buildId, { status: "validating", current_phase: "validate" });
    const report = await this.runValidatePhase(buildId, build.spec, build.blueprint, cycle);

    if (!report) return;

    // Check quality score
    if (report.overall_score >= MIN_QUALITY_SCORE) {
      // Passed!
      await updateBuild(this.env, buildId, {
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

      await updateBuild(this.env, buildId, {
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
      await updateBuild(this.env, buildId, {
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
    const ceoPrompt = buildCEOPrompt(input);
    const ceoResult = await this.executeStep(buildId, "plan", "ceo", "reasoning", ceoPrompt, cycle);
    if (!ceoResult) return null;
    totalTokens += ceoResult.tokens;

    const spec = ceoResult.output as unknown as ProjectSpec;

    // Step 2: AI Architect — Architecture Blueprint
    const architectPrompt = buildArchitectPrompt(spec);
    const architectResult = await this.executeStep(buildId, "plan", "architect", "reasoning", architectPrompt, cycle);
    if (!architectResult) return null;
    totalTokens += architectResult.tokens;

    const blueprint = architectResult.output as unknown as ArchitectureBlueprint;

    // Step 3: Contract Generation
    const contractPrompt = buildContractPrompt(spec, blueprint);
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
    const validationPrompt = buildContractValidationPrompt(contracts, spec, blueprint);
    const validationResult = await this.executeStep(buildId, "plan", "contract_validator", "reasoning", validationPrompt, cycle);
    if (!validationResult) return null;
    totalTokens += validationResult.tokens;

    await updateBuild(this.env, buildId, { total_tokens: totalTokens });

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
    await updateBuild(this.env, buildId, { total_files: allFiles.length });
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
    const prompt = buildAgentPrompt(role, spec, blueprint, contracts, existingFiles, feedback);
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
    const structuralPrompt = buildStructuralValidatorPrompt(fileList, blueprint);
    const structuralResult = await this.executeStep(buildId, "validate", "structural_validator", "reasoning", structuralPrompt, cycle);
    if (!structuralResult) return null;

    // Step 2: AI Code Reviewer
    const codeReviewPrompt = buildCodeReviewPrompt(fileList, spec);
    const codeReviewResult = await this.executeStep(buildId, "validate", "code_reviewer", "review", codeReviewPrompt, cycle);
    if (!codeReviewResult) return null;

    // Step 3: QA Cross-Validator
    const qaPrompt = buildQAValidatorPrompt(fileList, blueprint, spec);
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

    const fixerPrompt = buildFixerPrompt(
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
    if (await isCancelled(this.env, buildId)) return null;

    const startTime = Date.now();

    // Update step status to running
    await updateStepByAgent(this.env, buildId, agentRole, cycle, {
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
      await updateStepByAgent(this.env, buildId, agentRole, cycle, {
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

      await updateStepByAgent(this.env, buildId, agentRole, cycle, {
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
  // PRIVATE: Helpers
  // ============================================================

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

  private getPhaseStatus(steps: ProjectBuildStep[]): string {
    if (steps.length === 0) return "waiting";
    if (steps.every((s) => s.status === "completed")) return "completed";
    if (steps.some((s) => s.status === "failed")) return "failed";
    if (steps.some((s) => s.status === "running")) return "running";
    return "waiting";
  }
}
