// ============================================================
// D1 Queries — ANALYTICS
// ============================================================

import type { AnalyticsEvent } from "@nexus/shared";
import { generateId, now } from "@nexus/shared";

export async function getAnalytics(db: D1Database, limit = 100): Promise<AnalyticsEvent[]> {
  const result = await db
    .prepare("SELECT id, event_type, product_id, run_id, ai_model, tokens_used, cost, latency_ms, cached, metadata, created_at FROM analytics ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<AnalyticsEvent>();
  return result.results;
}

export async function getAnalyticsByType(db: D1Database, eventType: string, limit = 100): Promise<AnalyticsEvent[]> {
  const result = await db
    .prepare("SELECT id, event_type, product_id, run_id, ai_model, tokens_used, cost, latency_ms, cached, metadata, created_at FROM analytics WHERE event_type = ? ORDER BY created_at DESC LIMIT ?")
    .bind(eventType, limit)
    .all<AnalyticsEvent>();
  return result.results;
}

/** Helper: record an analytics event */
export async function recordAnalyticsEvent(
  db: D1Database,
  event: Omit<AnalyticsEvent, "id" | "created_at">
): Promise<AnalyticsEvent> {
  const id = generateId();
  const created_at = now();
  await db
    .prepare(
      "INSERT INTO analytics (id, event_type, product_id, run_id, ai_model, tokens_used, cost, latency_ms, cached, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
      event.event_type,
      event.product_id ?? null,
      event.run_id ?? null,
      event.ai_model ?? null,
      event.tokens_used ?? null,
      event.cost,
      event.latency_ms ?? null,
      event.cached ? 1 : 0,
      event.metadata ? JSON.stringify(event.metadata) : null,
      created_at
    )
    .run();
  return { ...event, id, created_at };
}

export async function deleteAnalyticsEvent(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM analytics WHERE id = ?").bind(id).run();
}
