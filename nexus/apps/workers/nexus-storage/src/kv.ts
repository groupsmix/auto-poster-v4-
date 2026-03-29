// ============================================================
// KV Cache Helpers — Config storage + AI response cache
// KV stores: platform rules, prompts, AI registry, social rules,
//            settings, cached AI responses
// ============================================================

export interface CachedAIResponse {
  response: string;
  model_used: string;
  tokens: number;
  timestamp: string;
}

export type ConfigType =
  | "platform_rules"
  | "prompts"
  | "ai_registry"
  | "social_rules"
  | "settings";

const CONFIG_PREFIX = "config:";
const AI_CACHE_PREFIX = "cache:ai:";

export class KVCache {
  constructor(private kv: KVNamespace) {}

  // ============================================================
  // CONFIG OPERATIONS
  // ============================================================

  /** Read config from KV (platform rules, prompts, AI registry, social rules, settings) */
  async getConfig<T = unknown>(key: string): Promise<T | null> {
    const value = await this.kv.get(`${CONFIG_PREFIX}${key}`, "text");
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  /** Write config to KV */
  async setConfig(key: string, value: unknown): Promise<void> {
    await this.kv.put(`${CONFIG_PREFIX}${key}`, JSON.stringify(value));
  }

  /** Delete a config key */
  async deleteConfig(key: string): Promise<void> {
    await this.kv.delete(`${CONFIG_PREFIX}${key}`);
  }

  /**
   * After a D1 edit, mirror updated config to KV for fast reads.
   * This is the sync mechanism: D1 is source of truth, KV is fast cache.
   */
  async syncConfigToKV(type: ConfigType, d1Data: unknown): Promise<void> {
    await this.setConfig(type, d1Data);
  }

  // ============================================================
  // AI RESPONSE CACHE
  // ============================================================

  /** Read AI response cache entry by prompt hash */
  async getCachedAIResponse(hash: string): Promise<CachedAIResponse | null> {
    const key = hash.startsWith(AI_CACHE_PREFIX)
      ? hash
      : `${AI_CACHE_PREFIX}${hash}`;
    const value = await this.kv.get(key, "text");
    if (!value) return null;
    return JSON.parse(value) as CachedAIResponse;
  }

  /** Write AI response cache with expiration (TTL in seconds) */
  async setCachedAIResponse(
    hash: string,
    response: CachedAIResponse,
    ttl: number
  ): Promise<void> {
    if (ttl <= 0) return; // Don't cache if TTL is 0 (review, image, audio)

    const key = hash.startsWith(AI_CACHE_PREFIX)
      ? hash
      : `${AI_CACHE_PREFIX}${hash}`;
    await this.kv.put(key, JSON.stringify(response), {
      expirationTtl: ttl,
    });
  }

  /**
   * Delete AI cache entries matching a pattern.
   * KV doesn't support pattern deletion natively, so we list + delete.
   * If no pattern provided, deletes ALL AI cache entries.
   */
  async invalidateAICache(pattern?: string): Promise<number> {
    const prefix = pattern
      ? `${AI_CACHE_PREFIX}${pattern}`
      : AI_CACHE_PREFIX;

    let deleted = 0;
    let cursor: string | undefined;

    do {
      const list = await this.kv.list({
        prefix,
        cursor,
        limit: 1000,
      });

      const deletePromises = list.keys.map((key) => this.kv.delete(key.name));
      await Promise.all(deletePromises);
      deleted += list.keys.length;

      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return deleted;
  }

  // ============================================================
  // GENERIC KV OPERATIONS (for route handlers)
  // ============================================================

  /** Read any KV key (raw string) */
  async get(key: string): Promise<string | null> {
    return this.kv.get(key, "text");
  }

  /** Write any KV key with optional TTL (in seconds) */
  async put(key: string, value: string, ttl?: number): Promise<void> {
    const options: KVNamespacePutOptions = {};
    if (ttl && ttl > 0) {
      options.expirationTtl = ttl;
    }
    await this.kv.put(key, value, options);
  }

  /** Delete any KV key */
  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}
