// ============================================================
// D1 Queries — WORKFLOW RUNS
// ============================================================

import type { WorkflowRun, WorkflowStep, WorkflowStatus } from "@nexus/shared";
import { now } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getWorkflowRuns(db: D1Database, productId?: string): Promise<WorkflowRun[]> {
  if (productId) {
    const result = await db
      .prepare("SELECT * FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC")
      .bind(productId)
      .all<WorkflowRun>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT * FROM workflow_runs ORDER BY started_at DESC")
    .all<WorkflowRun>();
  return result.results;
}

export async function getWorkflowRunById(db: D1Database, id: string): Promise<WorkflowRun | null> {
  return db
    .prepare("SELECT * FROM workflow_runs WHERE id = ?")
    .bind(id)
    .first<WorkflowRun>();
}

export async function createWorkflowRun(
  db: D1Database,
  run: Omit<WorkflowRun, "total_tokens" | "total_cost" | "cache_hits">
): Promise<WorkflowRun> {
  await db
    .prepare(
      "INSERT INTO workflow_runs (id, product_id, batch_id, status, started_at, completed_at, current_step, total_steps, total_tokens, total_cost, cache_hits, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)"
    )
    .bind(
      run.id,
      run.product_id,
      run.batch_id ?? null,
      run.status,
      run.started_at ?? null,
      run.completed_at ?? null,
      run.current_step ?? null,
      run.total_steps ?? null,
      run.error ?? null
    )
    .run();
  return { ...run, total_tokens: 0, total_cost: 0, cache_hits: 0 };
}

export async function updateWorkflowRun(
  db: D1Database,
  id: string,
  data: Partial<Omit<WorkflowRun, "id">>
): Promise<void> {
  await executeUpdate(db, "workflow_runs", id, data as Record<string, unknown>, [
    { column: "product_id" },
    { column: "batch_id" },
    { column: "status" },
    { column: "started_at" },
    { column: "completed_at" },
    { column: "current_step" },
    { column: "total_steps" },
    { column: "total_tokens" },
    { column: "total_cost" },
    { column: "cache_hits" },
    { column: "error" },
  ]);
}

export async function deleteWorkflowRun(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("DELETE FROM workflow_runs WHERE id = ?")
    .bind(id)
    .run();
}

/** Helper: update workflow status shorthand */
export async function updateWorkflowStatus(
  db: D1Database,
  runId: string,
  status: WorkflowStatus
): Promise<void> {
  const completedStatuses: WorkflowStatus[] = [
    "completed",
    "failed",
    "approved",
    "rejected",
    "published",
    "cancelled",
  ];
  const completed_at = completedStatuses.includes(status) ? now() : null;

  if (completed_at) {
    await db
      .prepare("UPDATE workflow_runs SET status = ?, completed_at = ? WHERE id = ?")
      .bind(status, completed_at, runId)
      .run();
  } else {
    await db
      .prepare("UPDATE workflow_runs SET status = ? WHERE id = ?")
      .bind(status, runId)
      .run();
  }
}

/** Helper: get workflow run joined with its steps */
export async function getWorkflowWithSteps(
  db: D1Database,
  runId: string
): Promise<{ run: WorkflowRun; steps: WorkflowStep[] } | null> {
  const run = await getWorkflowRunById(db, runId);
  if (!run) return null;

  const stepsResult = await db
    .prepare("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_order ASC")
    .bind(runId)
    .all<WorkflowStep>();

  return { run, steps: stepsResult.results };
}
