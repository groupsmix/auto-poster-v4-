// ============================================================
// AI Health Scoring System
// Tracks reliability, latency, failure rates per model
// Health Score = (successful_calls / total_calls) * 100
// Data stored in D1 ai_models table, detailed calls in analytics
// ============================================================

/** Runtime health state per model (in-memory, synced to D1 periodically) */
export interface ModelHealthState {
  modelId: string;
  modelName: string;
  status: "active" | "sleeping" | "rate_limited" | "no_key";
  rateLimitResetAt?: number;
  dailyLimitResetAt?: number;
  healthScore: number;
  totalCalls: number;
  totalFailures: number;
  avgLatencyMs: number;
  lastCallAt?: number;
  lastErrorAt?: number;
  lastError?: string;
}

/** Health report for all models */
export interface HealthReport {
  models: ModelHealthState[];
  generatedAt: number;
}

/** Reorder suggestion when model #2 outperforms model #1 */
export interface ReorderSuggestion {
  taskType: string;
  currentFirst: string;
  suggestedFirst: string;
  healthDiff: number;
  message: string;
}

// In-memory health state map: modelId -> ModelHealthState
const healthStates = new Map<string, ModelHealthState>();

// ============================================================
// GET OR INIT HEALTH STATE
// ============================================================

export function getOrInitHealth(
  modelId: string,
  modelName: string
): ModelHealthState {
  let state = healthStates.get(modelId);
  if (!state) {
    state = {
      modelId,
      modelName,
      status: "active",
      healthScore: 100,
      totalCalls: 0,
      totalFailures: 0,
      avgLatencyMs: 0,
    };
    healthStates.set(modelId, state);
  }
  return state;
}

// ============================================================
// UPDATE HEALTH SCORE — called after every AI call
// ============================================================

export function updateHealthScore(
  modelId: string,
  modelName: string,
  success: boolean,
  latencyMs: number,
  error?: string
): ModelHealthState {
  const state = getOrInitHealth(modelId, modelName);

  state.totalCalls++;
  state.lastCallAt = Date.now();

  if (success) {
    // Update average latency (running average)
    state.avgLatencyMs =
      (state.avgLatencyMs * (state.totalCalls - 1) + latencyMs) /
      state.totalCalls;
  } else {
    state.totalFailures++;
    state.lastErrorAt = Date.now();
    state.lastError = error;
  }

  // Recalculate health score
  if (state.totalCalls > 0) {
    state.healthScore = Math.round(
      ((state.totalCalls - state.totalFailures) / state.totalCalls) * 100
    );
  }

  return state;
}

// ============================================================
// STATUS TRANSITIONS
// ============================================================

export function markRateLimited(modelId: string, modelName: string): void {
  const state = getOrInitHealth(modelId, modelName);
  state.status = "rate_limited";
  state.rateLimitResetAt = Date.now() + 3600_000; // +1 hour
  console.log(
    `[LIMIT] ${modelName} -> sleep 1hr (health: ${state.healthScore}%)`
  );
}

export function markSleeping(modelId: string, modelName: string): void {
  const state = getOrInitHealth(modelId, modelName);
  state.status = "sleeping";
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  state.dailyLimitResetAt = midnight.getTime();
  console.log(`[QUOTA] ${modelName} -> sleep until midnight`);
}

export function markNoKey(modelId: string, modelName: string): void {
  const state = getOrInitHealth(modelId, modelName);
  state.status = "no_key";
}

/** Check if a rate-limited or sleeping model can be reactivated */
export function tryReactivate(modelId: string, modelName: string): boolean {
  const state = getOrInitHealth(modelId, modelName);
  const now = Date.now();

  if (
    state.status === "rate_limited" &&
    state.rateLimitResetAt &&
    now >= state.rateLimitResetAt
  ) {
    state.status = "active";
    state.rateLimitResetAt = undefined;
    console.log(`[WAKE] ${modelName} — rate limit reset, reactivating`);
    return true;
  }

  if (
    state.status === "sleeping" &&
    state.dailyLimitResetAt &&
    now >= state.dailyLimitResetAt
  ) {
    state.status = "active";
    state.dailyLimitResetAt = undefined;
    console.log(`[WAKE] ${modelName} — daily limit reset, reactivating`);
    return true;
  }

  return false;
}

// ============================================================
// HEALTH REPORT — for /ai/health endpoint
// ============================================================

export function getHealthReport(): HealthReport {
  return {
    models: Array.from(healthStates.values()).sort(
      (a, b) => b.healthScore - a.healthScore
    ),
    generatedAt: Date.now(),
  };
}

// ============================================================
// REORDER SUGGESTION
// If model #2 has higher health than #1 for a task type,
// suggest reordering (manual confirmation required)
// ============================================================

export function shouldSuggestReorder(
  taskType: string,
  modelIds: string[]
): ReorderSuggestion | null {
  if (modelIds.length < 2) return null;

  const first = healthStates.get(modelIds[0]);
  const second = healthStates.get(modelIds[1]);

  if (!first || !second) return null;

  // Only suggest if both have significant call volume
  if (first.totalCalls < 50 || second.totalCalls < 50) return null;

  // Suggest if #2 has meaningfully higher health score
  const healthDiff = second.healthScore - first.healthScore;
  if (healthDiff >= 5) {
    return {
      taskType,
      currentFirst: first.modelName,
      suggestedFirst: second.modelName,
      healthDiff,
      message: `${second.modelName} (${second.healthScore}%) has been more reliable than ${first.modelName} (${first.healthScore}%) — consider reordering`,
    };
  }

  return null;
}
