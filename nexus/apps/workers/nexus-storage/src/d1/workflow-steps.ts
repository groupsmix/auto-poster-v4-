// ============================================================
// D1 Queries — WORKFLOW STEPS
// ============================================================

import type { WorkflowStep, StepStatusType } from "@nexus/shared";
import { now, StepStatus } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getWorkflowSteps(db: D1Database, runId: string): Promise<WorkflowStep[]> {
  const result = await db
    .prepare("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_order ASC")
    .bind(runId)
    .all<WorkflowStep>();
  return result.results;
}

export async function getWorkflowStepById(db: D1Database, id: string): Promise<WorkflowStep | null> {
  return db
    .prepare("SELECT * FROM workflow_steps WHERE id = ?")
    .bind(id)
    .first<WorkflowStep>();
}

export async function createWorkflowStep(db: D1Database, step: WorkflowStep): Promise<WorkflowStep> {
  await db
    .prepare(
      "INSERT INTO workflow_steps (id, run_id, step_name, step_order, status, ai_used, ai_tried, input, output, tokens_used, cost, cached, latency_ms, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      step.id,
      step.run_id,
      step.step_name,
      step.step_order,
      step.status,
      step.ai_used ?? null,
      step.ai_tried ? JSON.stringify(step.ai_tried) : null,
      step.input ? JSON.stringify(step.input) : null,
      step.output ? JSON.stringify(step.output) : null,
      step.tokens_used ?? null,
      step.cost,
      step.cached ? 1 : 0,
      step.latency_ms ?? null,
      step.started_at ?? null,
      step.completed_at ?? null
    )
    .run();
  return step;
}

export async function updateWorkflowStep(
  db: D1Database,
  id: string,
  data: Partial<Omit<WorkflowStep, "id">>
): Promise<void> {
  await executeUpdate(db, "workflow_steps", id, data as Record<string, unknown>, [
    { column: "run_id" },
    { column: "step_name" },
    { column: "step_order" },
    { column: "status" },
    { column: "ai_used" },
    { column: "ai_tried", transform: (v) => JSON.stringify(v) },
    { column: "input", transform: (v) => JSON.stringify(v) },
    { column: "output", transform: (v) => JSON.stringify(v) },
    { column: "tokens_used" },
    { column: "cost" },
    { column: "cached", transform: (v) => (v ? 1 : 0) },
    { column: "latency_ms" },
    { column: "started_at" },
    { column: "completed_at" },
  ]);
}

/** Helper: update step status with optional output */
export async function updateStepStatus(
  db: D1Database,
  stepId: string,
  status: StepStatusType,
  output?: Record<string, unknown>
): Promise<void> {
  if (output) {
    const completed_at = status === StepStatus.COMPLETED || status === StepStatus.FAILED ? now() : null;
    await db
      .prepare(
        "UPDATE workflow_steps SET status = ?, output = ?, completed_at = ? WHERE id = ?"
      )
      .bind(status, JSON.stringify(output), completed_at, stepId)
      .run();
  } else {
    await db
      .prepare("UPDATE workflow_steps SET status = ? WHERE id = ?")
      .bind(status, stepId)
      .run();
  }
}

export async function deleteWorkflowStep(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("DELETE FROM workflow_steps WHERE id = ?")
    .bind(id)
    .run();
}
