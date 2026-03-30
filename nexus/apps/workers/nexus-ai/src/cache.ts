// ============================================================
// V4: AI Response Caching Layer
// SHA-256 prompt hash -> KV cache with task-type TTLs
// Cache-first lookup: check KV before any AI call
// ============================================================

import { hashPrompt, getCacheTTL } from "@nexus/shared";
import type { Env } from "@nexus/shared";

/** Shape of a cached AI response entry in KV */
export interface CacheEntry {
  response: string;
  model_used: string;
  tokens?: number;
  timestamp: number;
}

/** Cache hit/miss stats tracked in memory per worker instance */
interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
}

let stats: CacheStats = { hits: 0, misses: 0, writes: 0 };

/** KV key for persisted cache stats */
const KV_CACHE_STATS_KEY = "cache-stats:counters";

/** Whether we have attempted to hydrate stats from KV this worker instance */
let statsHydrated = false;

/** Hydrate cache stats from KV on first access */
async function hydrateStats(env: Env): Promise<void> {
  if (statsHydrated) return;
  statsHydrated = true;

  try {
    const persisted = await env.KV.get<CacheStats>(KV_CACHE_STATS_KEY, "json");
    if (persisted) {
      stats = persisted;
    }
  } catch {
    // KV read failed — start fresh
  }
}

/** Persist cache stats to KV (best-effort, short TTL) */
async function persistStats(env: Env): Promise<void> {
  try {
    await env.KV.put(KV_CACHE_STATS_KEY, JSON.stringify(stats), {
      expirationTtl: 86400, // 24 hours
    });
  } catch {
    // Best-effort — don't break the request
  }
}

// ============================================================
// CHECK CACHE — returns cached response or null
// ============================================================

export async function checkCache(
  prompt: string,
  taskType: string,
  env: Env
): Promise<CacheEntry | null> {
  // Don't even check cache for types with TTL = 0
  // Hydrate stats from KV on first call this worker instance
  await hydrateStats(env);

  const ttl = getCacheTTL(taskType);
  if (ttl === 0) {
    stats.misses++;
    return null;
  }

  const key = await hashPrompt(prompt, taskType);
  const cached = await env.KV.get<CacheEntry>(key, "json");

  if (cached) {
    stats.hits++;
    await persistStats(env);
    console.log(
      `[CACHE HIT] ${taskType} -- saved tokens (model: ${cached.model_used})`
    );
    return cached;
  }

  stats.misses++;
  return null;
}

// ============================================================
// WRITE CACHE — store successful AI response in KV
// ============================================================

export async function writeCache(
  prompt: string,
  taskType: string,
  response: string,
  modelUsed: string,
  tokens: number | undefined,
  env: Env
): Promise<void> {
  const ttl = getCacheTTL(taskType);
  if (ttl === 0) return; // Don't cache this task type

  const key = await hashPrompt(prompt, taskType);
  const entry: CacheEntry = {
    response,
    model_used: modelUsed,
    tokens,
    timestamp: Date.now(),
  };

  await env.KV.put(key, JSON.stringify(entry), {
    expirationTtl: ttl,
  });

  stats.writes++;
  await persistStats(env);
  console.log(`[CACHE WRITE] ${taskType} -- TTL ${ttl}s (key: ${key.slice(0, 20)}...)`);
}

// ============================================================
// CACHE STATS — for /ai/cache/stats endpoint
// ============================================================

export async function getCacheStats(env: Env): Promise<CacheStats & { hitRate: string }> {
  await hydrateStats(env);
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) + "%" : "0%";
  return { ...stats, hitRate };
}
