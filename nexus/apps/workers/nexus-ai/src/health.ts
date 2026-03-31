// ============================================================
// V4: AI Health Scoring System
// Tracks reliability, latency, failure rates per model
// Health Score = (successful_calls / total_calls) * 100
// Stores health data in D1 ai_models table
// Stores detailed call data in D1 analytics table
// ============================================================

import { calculateHealthScore, generateId, now } from "@nexus/shared";
import type { Env } from "@nexus/shared";

/** In-memory health data per model (synced to D1 periodically) */
export interface ModelHealthData {
  modelId: string;
  modelName: string;
  totalCalls: number;
  totalFailures: number;
  avgLatencyMs: number;
  healthScore: number;
  lastCallAt?: string;
  lastErrorAt?: string;
  lastError?: string;
}

/** In-memory health store — keyed by model ID */
const healthStore: Map<string, ModelHealthData> = new Map();

/** KV key prefix for persisted health data */
const HEALTH_KV_PREFIX = "health:";
/** TTL for persisted health data in KV (24 hours — prevents stale data loss across restarts) */
const HEALTH_KV_TTL = 86400;
/**
 * Persist to KV every N calls. Set to 1 to persist on every call
 * (important for critical state changes like rate-limit transitions).
 */
const HEALTH_PERSIST_INTERVAL = 1;
/** KV key for tracking last daily snapshot date per model */
const HEALTH_SNAPSHOT_PREFIX = "health_snapshot:";

// ============================================================
// UPDATE HEALTH SCORE — called after every AI call
// ============================================================

export async function updateHealthScore(
  modelId: string,
  modelName: string,
  success: boolean,
  latencyMs: number,
  env: Env,
  errorMessage?: string
): Promise<void> {
  // Get or create health data, restoring from KV if available
  let health = healthStore.get(modelId);
  if (!health) {
    const persisted = await env.KV.get<ModelHealthData>(
      `${HEALTH_KV_PREFIX}${modelId}`,
      "json"
    ).catch(() => null);
    if (persisted) {
      health = persisted;
      console.log(`[HEALTH] Restored ${modelId} from KV (score: ${health.healthScore})`);
    } else {
      health = {
        modelId,
        modelName,
        totalCalls: 0,
        totalFailures: 0,
        avgLatencyMs: 0,
        healthScore: 100,
      };
    }
    healthStore.set(modelId, health);
  }

  // Update stats
  health.totalCalls++;
  if (!success) {
    health.totalFailures++;
    health.lastErrorAt = now();
    health.lastError = errorMessage;
  }
  health.lastCallAt = now();

  // Recalculate average latency (rolling average)
  health.avgLatencyMs =
    (health.avgLatencyMs * (health.totalCalls - 1) + latencyMs) /
    health.totalCalls;

  // Recalculate health score
  health.healthScore = calculateHealthScore(
    health.totalCalls,
    health.totalFailures
  );

  // Persist health data to KV periodically (survives worker restarts)
  if (health.totalCalls % HEALTH_PERSIST_INTERVAL === 0) {
    await env.KV.put(
      `${HEALTH_KV_PREFIX}${modelId}`,
      JSON.stringify(health),
      { expirationTtl: HEALTH_KV_TTL }
    ).catch(() => {
      console.log(`[HEALTH] Could not persist health for ${modelId}`);
    });
  }

  // Persist to D1 via nexus-storage service binding (consistent with architecture)
  if (env.NEXUS_STORAGE) {
    try {
      await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `UPDATE ai_models SET total_calls = ?, total_failures = ?, avg_latency_ms = ?, health_score = ? WHERE id = ?`,
          params: [
            health.totalCalls,
            health.totalFailures,
            Math.round(health.avgLatencyMs),
            health.healthScore,
            modelId,
          ],
        }),
      });
    } catch {
      console.log(`[HEALTH] Could not update D1 for model ${modelId}`);
    }

    // Log to D1 analytics table via nexus-storage
    try {
      await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `INSERT INTO analytics (id, event_type, ai_model, tokens_used, cost, latency_ms, cached, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            generateId(),
            "ai_call",
            modelName,
            0,
            0,
            Math.round(latencyMs),
            0,
            JSON.stringify({ success, error: errorMessage }),
            now(),
          ],
        }),
      });
    } catch {
      console.log(`[HEALTH] Could not write analytics for ${modelId}`);
    }

    // Save daily health snapshot (one per model per day)
    await saveDailySnapshot(modelId, modelName, health, env);
  }
}

// ============================================================
// GET HEALTH REPORT — returns all models with their health stats
// ============================================================

export async function getHealthReport(env: Env): Promise<ModelHealthData[]> {
  // Restore any persisted health data not yet in memory
  const kvList = await env.KV.list({ prefix: HEALTH_KV_PREFIX }).catch(() => ({ keys: [] }));
  for (const key of kvList.keys) {
    const modelId = key.name.slice(HEALTH_KV_PREFIX.length);
    if (!healthStore.has(modelId)) {
      const persisted = await env.KV.get<ModelHealthData>(key.name, "json").catch(() => null);
      if (persisted) {
        healthStore.set(modelId, persisted);
      }
    }
  }
  return Array.from(healthStore.values()).sort(
    (a, b) => b.healthScore - a.healthScore
  );
}

// ============================================================
// DAILY HEALTH SNAPSHOTS — persist to D1 for 7-day window
// ============================================================

/** Get today's date as YYYY-MM-DD */
function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Save a daily health snapshot for a model.
 * Uses KV to track whether today's snapshot has already been written,
 * then upserts into D1 ai_health_daily table.
 */
async function saveDailySnapshot(
  modelId: string,
  modelName: string,
  health: ModelHealthData,
  env: Env
): Promise<void> {
  const today = todayDate();
  const kvKey = `${HEALTH_SNAPSHOT_PREFIX}${modelId}:${today}`;

  try {
    // Check if we already saved a snapshot for this model today
    const existing = await env.KV.get(kvKey).catch(() => null);
    if (existing) return; // Already saved today

    // Upsert daily snapshot into D1
    await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql: `INSERT INTO ai_health_daily (id, model_id, model_name, date, total_calls, total_failures, avg_latency_ms, health_score, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(model_id, date) DO UPDATE SET
                total_calls = excluded.total_calls,
                total_failures = excluded.total_failures,
                avg_latency_ms = excluded.avg_latency_ms,
                health_score = excluded.health_score`,
        params: [
          generateId(),
          modelId,
          modelName,
          today,
          health.totalCalls,
          health.totalFailures,
          Math.round(health.avgLatencyMs),
          health.healthScore,
          now(),
        ],
      }),
    });

    // Mark today as saved in KV (expires at end of day + buffer)
    await env.KV.put(kvKey, "1", { expirationTtl: 86400 });
  } catch {
    console.log(`[HEALTH] Could not save daily snapshot for ${modelId}`);
  }
}

/**
 * Get the average health score for a model over the last 7 days from D1.
 * Returns null if no snapshot data is available.
 */
async function get7DayAvgHealth(
  modelId: string,
  env: Env
): Promise<number | null> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql: `SELECT AVG(health_score) as avg_score, COUNT(*) as days
              FROM ai_health_daily
              WHERE model_id = ? AND date >= ?`,
        params: [modelId, sevenDaysAgo],
      }),
    });

    const json = (await resp.json()) as {
      success: boolean;
      data?: { results?: Array<{ avg_score: number | null; days: number }> };
    };

    if (
      json.success &&
      json.data?.results?.[0] &&
      json.data.results[0].days > 0
    ) {
      return json.data.results[0].avg_score;
    }
  } catch {
    console.log(`[HEALTH] Could not query 7-day history for ${modelId}`);
  }
  return null;
}

// ============================================================
// SHOULD SUGGEST REORDER — if model #2 has higher health
// than model #1 for 7+ days, suggest reordering
// ============================================================

export interface ReorderSuggestion {
  taskType: string;
  currentFirst: string;
  suggestedFirst: string;
  currentFirstHealth: number;
  suggestedFirstHealth: number;
  reason: string;
}

export async function shouldSuggestReorder(
  taskType: string,
  modelIds: string[],
  env: Env
): Promise<ReorderSuggestion | null> {
  if (modelIds.length < 2) return null;

  const first = healthStore.get(modelIds[0]);
  const second = healthStore.get(modelIds[1]);

  if (!first || !second) return null;

  // Both models need at least 10 calls to make a meaningful comparison
  if (first.totalCalls < 10 || second.totalCalls < 10) return null;

  // Check if second model has meaningfully higher health (current)
  if (second.healthScore > first.healthScore + 5) {
    // Validate against 7-day rolling window from D1 snapshots
    const firstAvg = await get7DayAvgHealth(first.modelId, env);
    const secondAvg = await get7DayAvgHealth(second.modelId, env);

    // If we have historical data, require the trend to be consistent
    if (firstAvg !== null && secondAvg !== null) {
      if (secondAvg <= firstAvg + 3) {
        // Historical data doesn't support the reorder — short-term blip
        return null;
      }
    }

    return {
      taskType,
      currentFirst: first.modelName,
      suggestedFirst: second.modelName,
      currentFirstHealth: first.healthScore,
      suggestedFirstHealth: second.healthScore,
      reason: `${second.modelName} (health: ${second.healthScore}%) has been consistently more reliable than ${first.modelName} (health: ${first.healthScore}%) over the past 7 days. Consider reordering.`,
    };
  }

  return null;
}
