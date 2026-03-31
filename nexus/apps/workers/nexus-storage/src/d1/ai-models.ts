// ============================================================
// D1 Queries — AI MODELS
// ============================================================

import type { AIModel } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getAIModels(db: D1Database): Promise<AIModel[]> {
  const result = await db
    .prepare("SELECT * FROM ai_models ORDER BY task_type, rank ASC")
    .all<AIModel>();
  return result.results;
}

export async function getAIModelById(db: D1Database, id: string): Promise<AIModel | null> {
  return db
    .prepare("SELECT * FROM ai_models WHERE id = ?")
    .bind(id)
    .first<AIModel>();
}

/** Helper: get AI models for a specific task type, ordered by rank */
export async function getAIModelsByTaskType(db: D1Database, taskType: string): Promise<AIModel[]> {
  const result = await db
    .prepare(
      "SELECT * FROM ai_models WHERE task_type = ? AND status = 'active' ORDER BY rank ASC"
    )
    .bind(taskType)
    .all<AIModel>();
  return result.results;
}

export async function createAIModel(db: D1Database, model: AIModel): Promise<AIModel> {
  await db
    .prepare(
      "INSERT INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, rate_limit_reset_at, daily_limit_reset_at, is_free_tier, health_score, total_calls, total_failures, avg_latency_ms, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      model.id,
      model.name,
      model.provider ?? null,
      model.task_type,
      model.rank,
      model.api_key_secret_name ?? null,
      model.is_workers_ai ? 1 : 0,
      model.status,
      model.rate_limit_reset_at ?? null,
      model.daily_limit_reset_at ?? null,
      model.is_free_tier ? 1 : 0,
      model.health_score,
      model.total_calls,
      model.total_failures,
      model.avg_latency_ms,
      model.notes ?? null
    )
    .run();
  return model;
}

export async function updateAIModel(
  db: D1Database,
  id: string,
  data: Partial<Omit<AIModel, "id">>
): Promise<void> {
  await executeUpdate(db, "ai_models", id, data as Record<string, unknown>, [
    { column: "name" },
    { column: "provider" },
    { column: "task_type" },
    { column: "rank" },
    { column: "api_key_secret_name" },
    { column: "is_workers_ai", transform: (v) => (v ? 1 : 0) },
    { column: "status" },
    { column: "rate_limit_reset_at" },
    { column: "daily_limit_reset_at" },
    { column: "is_free_tier", transform: (v) => (v ? 1 : 0) },
    { column: "health_score" },
    { column: "total_calls" },
    { column: "total_failures" },
    { column: "avg_latency_ms" },
    { column: "notes" },
  ]);
}

export async function deleteAIModel(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM ai_models WHERE id = ?").bind(id).run();
}
