// ============================================================
// AI Response Caching Layer
// SHA-256 hash of prompt+taskType -> KV cache with task-type TTLs
// Cache checked BEFORE any AI call to save tokens and latency
// ============================================================

/** Env binding for KV cache */
interface CacheEnv {
  KV: KVNamespace;
}

/** Stored cache entry format */
interface CacheEntry {
  response: string;
  model_used: string;
  tokens?: number;
  timestamp: number;
}

/** TTL per task type (seconds). 0 = never cache */
const TTL_MAP: Record<string, number> = {
  research: 3600, // 1 hour
  writing: 86400, // 24 hours
  copywriting: 86400, // 24 hours
  seo: 21600, // 6 hours
  seo_formatting: 21600, // 6 hours
  code: 86400, // 24 hours
  reasoning: 86400, // 24 hours
  platform_variation: 86400, // 24 hours
  social_adaptation: 86400, // 24 hours
  humanizer: 86400, // 24 hours
  quality_review: 0, // never cache
  text_on_image: 0, // never cache (image)
  artistic_image: 0, // never cache (image)
  image_editing: 0, // never cache (image)
  mockup: 0, // never cache (image)
  music: 0, // never cache (audio)
  voice_tts: 0, // never cache (audio)
};

// ============================================================
// HELPERS
// ============================================================

/** Generate SHA-256 hash key from prompt + taskType */
async function generateCacheKey(
  prompt: string,
  taskType: string
): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(prompt + taskType)
  );
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `cache:ai:${hex}`;
}

// ============================================================
// CHECK CACHE — returns cached response or null
// ============================================================

export async function checkCache(
  prompt: string,
  taskType: string,
  env: CacheEnv
): Promise<CacheEntry | null> {
  const ttl = TTL_MAP[taskType] ?? 0;
  if (ttl === 0) return null; // task type is never cached

  const key = await generateCacheKey(prompt, taskType);
  const cached = await env.KV.get<CacheEntry>(key, "json");

  if (cached) {
    console.log(`[CACHE HIT] ${taskType} — saved tokens`);
    return cached;
  }

  return null;
}

// ============================================================
// WRITE CACHE — store response with task-type-specific TTL
// ============================================================

export async function writeCache(
  prompt: string,
  taskType: string,
  response: string,
  env: CacheEnv,
  modelUsed?: string,
  tokens?: number
): Promise<void> {
  const ttl = TTL_MAP[taskType] ?? 0;
  if (ttl === 0) return; // don't cache this type

  const key = await generateCacheKey(prompt, taskType);
  const entry: CacheEntry = {
    response,
    model_used: modelUsed ?? "unknown",
    tokens,
    timestamp: Date.now(),
  };

  await env.KV.put(key, JSON.stringify(entry), {
    expirationTtl: ttl,
  });
}

// ============================================================
// CACHE STATS — for the /ai/cache/stats endpoint
// ============================================================

/** In-memory counters (reset on worker restart, persisted via analytics) */
let cacheHits = 0;
let cacheMisses = 0;

export function recordCacheHit(): void {
  cacheHits++;
}

export function recordCacheMiss(): void {
  cacheMisses++;
}

export function getCacheStats(): { hits: number; misses: number; hitRate: string } {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(1) + "%" : "0%";
  return { hits: cacheHits, misses: cacheMisses, hitRate };
}

export { TTL_MAP };
