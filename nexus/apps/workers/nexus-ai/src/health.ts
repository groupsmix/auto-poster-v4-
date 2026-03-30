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
/** TTL for persisted health data in KV (1 hour) */
const HEALTH_KV_TTL = 3600;
/** Only persist to KV every N calls to avoid excessive writes */
const HEALTH_PERSIST_INTERVAL = 5;

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

  // Persist to D1: update ai_models table
  try {
    await env.DB.prepare(
      `UPDATE ai_models
       SET total_calls = ?, total_failures = ?, avg_latency_ms = ?, health_score = ?
       WHERE id = ?`
    )
      .bind(
        health.totalCalls,
        health.totalFailures,
        Math.round(health.avgLatencyMs),
        health.healthScore,
        modelId
      )
      .run();
  } catch {
    // D1 may not have this model yet — that's okay, analytics still logs it
    console.log(`[HEALTH] Could not update D1 for model ${modelId}`);
  }

  // Log to D1 analytics table
  try {
    await env.DB.prepare(
      `INSERT INTO analytics (id, event_type, ai_model, tokens_used, cost, latency_ms, cached, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        generateId(),
        "ai_call",
        modelName,
        0,
        0,
        Math.round(latencyMs),
        0,
        JSON.stringify({ success, error: errorMessage }),
        now()
      )
      .run();
  } catch {
    console.log(`[HEALTH] Could not write analytics for ${modelId}`);
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

export function shouldSuggestReorder(
  taskType: string,
  modelIds: string[]
): ReorderSuggestion | null {
  if (modelIds.length < 2) return null;

  const first = healthStore.get(modelIds[0]);
  const second = healthStore.get(modelIds[1]);

  if (!first || !second) return null;

  // Both models need at least 10 calls to make a meaningful comparison
  if (first.totalCalls < 10 || second.totalCalls < 10) return null;

  // Check if second model has meaningfully higher health
  if (second.healthScore > first.healthScore + 5) {
    // Check if first model has been consistently lower
    // (simplified: we just check current state — full 7-day tracking
    // would require time-series data in D1 which can be added later)
    return {
      taskType,
      currentFirst: first.modelName,
      suggestedFirst: second.modelName,
      currentFirstHealth: first.healthScore,
      suggestedFirstHealth: second.healthScore,
      reason: `${second.modelName} (health: ${second.healthScore}%) is more reliable than ${first.modelName} (health: ${first.healthScore}%). Consider reordering.`,
    };
  }

  return null;
}
