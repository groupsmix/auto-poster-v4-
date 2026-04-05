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

const stats: CacheStats = { hits: 0, misses: 0, writes: 0 };
let statsRestored = false;

/** KV key for persisted cache stats */
const CACHE_STATS_KV_KEY = "cache_stats";
/** TTL for persisted cache stats in KV (1 hour) */
const CACHE_STATS_KV_TTL = 3600;
/** Only persist to KV every N operations to avoid excessive writes */
const CACHE_STATS_PERSIST_INTERVAL = 10;

/** Restore stats from KV if not already restored */
async function restoreStats(env: Env): Promise<void> {
  if (statsRestored) return;
  statsRestored = true;
  const persisted = await env.KV.get<CacheStats>(CACHE_STATS_KV_KEY, "json").catch(() => null);
  if (persisted) {
    stats.hits = persisted.hits;
    stats.misses = persisted.misses;
    stats.writes = persisted.writes;
    console.log(`[CACHE] Restored stats from KV: ${stats.hits} hits, ${stats.misses} misses`);
  }
}

/** Persist stats to KV periodically */
async function maybePersistStats(env: Env): Promise<void> {
  const total = stats.hits + stats.misses + stats.writes;
  if (total % CACHE_STATS_PERSIST_INTERVAL === 0) {
    await env.KV.put(CACHE_STATS_KV_KEY, JSON.stringify(stats), {
      expirationTtl: CACHE_STATS_KV_TTL,
    }).catch(() => {
      console.log("[CACHE] Could not persist cache stats");
    });
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
  // Restore stats from KV on first call
  await restoreStats(env);

  // Don't even check cache for types with TTL = 0
  const ttl = getCacheTTL(taskType);
  if (ttl === 0) {
    stats.misses++;
    await maybePersistStats(env);
    return null;
  }

  const key = await hashPrompt(prompt, taskType);
  const cached = await env.KV.get<CacheEntry>(key, "json");

  if (cached) {
    stats.hits++;
    await maybePersistStats(env);
    console.log(
      `[CACHE HIT] ${taskType} -- saved tokens (model: ${cached.model_used})`
    );
    return cached;
  }

  stats.misses++;
  await maybePersistStats(env);
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
  await maybePersistStats(env);
  console.log(`[CACHE WRITE] ${taskType} -- TTL ${ttl}s (key: ${key.slice(0, 20)}...)`);
}

// ============================================================
// CACHE STATS — for /ai/cache/stats endpoint
// ============================================================

export async function getCacheStats(env: Env): Promise<CacheStats & { hitRate: string }> {
  await restoreStats(env);
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) + "%" : "0%";
  return { ...stats, hitRate };
}
