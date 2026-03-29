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

// ============================================================
// CHECK CACHE — returns cached response or null
// ============================================================

export async function checkCache(
  prompt: string,
  taskType: string,
  env: Env
): Promise<CacheEntry | null> {
  // Don't even check cache for types with TTL = 0
  const ttl = getCacheTTL(taskType);
  if (ttl === 0) {
    stats.misses++;
    return null;
  }

  const key = await hashPrompt(prompt, taskType);
  const cached = await env.KV.get<CacheEntry>(key, "json");

  if (cached) {
    stats.hits++;
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
  console.log(`[CACHE WRITE] ${taskType} -- TTL ${ttl}s (key: ${key.slice(0, 20)}...)`);
}

// ============================================================
// CACHE STATS — for /ai/cache/stats endpoint
// ============================================================

export function getCacheStats(): CacheStats & { hitRate: string } {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) + "%" : "0%";
  return { ...stats, hitRate };
}
