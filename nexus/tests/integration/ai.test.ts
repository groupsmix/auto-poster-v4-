// ============================================================
// Integration Tests — nexus-ai Worker
// Tests: Failover engine, Cache, Health scoring, Workers AI fallback
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../apps/workers/nexus-ai/src/index";
import type { ApiResponse } from "@nexus/shared";
import {
  createMockD1,
  createMockKV,
  createMockFetcher,
  jsonResponse,
  type MockD1Database,
  type MockKVNamespace,
} from "../helpers/mocks";

/** Typed API response for test assertions (replaces Record<string, any>) */
interface TestApiResponse extends ApiResponse<Record<string, unknown>> {
  service?: string;
  status?: string;
}

function buildEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: createMockD1(),
    KV: createMockKV(),
    NEXUS_STORAGE: createMockFetcher(),
    AI: {
      run: vi.fn().mockResolvedValue({ response: "Workers AI fallback response" }),
    },
    DEEPSEEK_API_KEY: "test-deepseek-key",
    SILICONFLOW_API_KEY: "test-siliconflow-key",
    OPENROUTER_API_KEY: "test-openrouter-key",
    ...overrides,
  };
}

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

// ============================================================
// HEALTH & INFO
// ============================================================

describe("nexus-ai: Health & Info", () => {
  it("GET / returns service info", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data).toHaveProperty("service", "nexus-ai");
    expect(data).toHaveProperty("status", "ok");
  });

  it("GET /ai/health returns health report", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/ai/health"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("models");
    expect(data.data).toHaveProperty("modelStates");
  });

  it("GET /ai/cache/stats returns cache statistics", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/ai/cache/stats"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("hits");
    expect(data.data).toHaveProperty("misses");
    expect(data.data).toHaveProperty("hitRate");
  });
});

// ============================================================
// AI REGISTRY
// ============================================================

describe("nexus-ai: Registry", () => {
  it("GET /ai/registry returns all task types and models", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/ai/registry"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("taskTypes");
    expect(data.data).toHaveProperty("registry");
    expect(Array.isArray(data.data.taskTypes)).toBe(true);
    expect(data.data.taskTypes.length).toBeGreaterThan(0);
  });

  it("POST /ai/registry/reorder returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/ai/registry/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(false);
  });

  it("POST /ai/registry/reorder returns 400 for unknown task type", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/ai/registry/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "nonexistent_task",
          modelIds: ["m1"],
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });
});

// ============================================================
// AI RUN — FAILOVER ENGINE
// ============================================================

describe("nexus-ai: POST /ai/run — Failover", () => {
  it("returns 400 when taskType or prompt missing", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "test" }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(false);
    expect(data.error).toContain("taskType");
  });

  it("returns 400 for unknown task type", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "invalid_task",
          prompt: "test",
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(false);
  });

  it("returns cached result when KV has a cache hit", async () => {
    const kv = createMockKV();
    // Pre-populate cache with a known hash key
    // We need to match the hash of the prompt + taskType
    const cacheEntry = JSON.stringify({
      response: "cached research result",
      model_used: "test-model",
      tokens: 50,
      timestamp: Date.now(),
    });
    // Override get to always return the cache entry (simulates cache hit)
    kv.get = vi.fn().mockResolvedValue({
      response: "cached research result",
      model_used: "test-model",
      tokens: 50,
      timestamp: Date.now(),
    }) as MockKVNamespace["get"];

    const env = buildEnv({ KV: kv });

    const res = await app.fetch(
      makeRequest("/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "research",
          prompt: "research about cats",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data.cached).toBe(true);
    expect(data.data.model).toBe("cache");
  });

  it("falls through to Workers AI when no API keys configured", async () => {
    const db = createMockD1();
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0 },
    });

    const kv = createMockKV();
    // No cache hit
    kv.get = vi.fn().mockResolvedValue(null) as MockKVNamespace["get"];

    const ai = {
      run: vi.fn().mockResolvedValue({
        response: "Workers AI generated this",
      }),
    };

    const env = buildEnv({
      DB: db,
      KV: kv,
      AI: ai,
      // Remove all API keys so only Workers AI is available
      DEEPSEEK_API_KEY: undefined,
      SILICONFLOW_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
    });

    const res = await app.fetch(
      makeRequest("/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "research",
          prompt: "test Workers AI fallback",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    // Workers AI should be the model since no other keys
    expect(data.data.cached).toBe(false);
  });
});

// ============================================================
// CACHE — cache miss calls AI
// ============================================================

describe("nexus-ai: Cache behavior", () => {
  it("cache miss triggers AI call and writes back to cache", async () => {
    const kv = createMockKV();
    // Ensure no cache hit
    kv.get = vi.fn().mockResolvedValue(null) as MockKVNamespace["get"];

    const db = createMockD1();
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0 },
    });

    const ai = {
      run: vi.fn().mockResolvedValue({
        response: "fresh AI response",
      }),
    };

    const env = buildEnv({
      DB: db,
      KV: kv,
      AI: ai,
      DEEPSEEK_API_KEY: undefined,
      SILICONFLOW_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
    });

    const res = await app.fetch(
      makeRequest("/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "research",
          prompt: "fresh request for testing",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data.cached).toBe(false);
    // Cache should have been written
    expect(kv.put).toHaveBeenCalled();
  });
});

// ============================================================
// HEALTH SCORING
// ============================================================

describe("nexus-ai: Health Scoring", () => {
  it("health scores update after successful calls", async () => {
    const kv = createMockKV();
    kv.get = vi.fn().mockResolvedValue(null) as MockKVNamespace["get"];

    const db = createMockD1();
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0 },
    });

    const ai = {
      run: vi.fn().mockResolvedValue({
        response: "test response for health",
      }),
    };

    const env = buildEnv({
      DB: db,
      KV: kv,
      AI: ai,
      DEEPSEEK_API_KEY: undefined,
      SILICONFLOW_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
    });

    // Make a call to update health
    await app.fetch(
      makeRequest("/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "writing",
          prompt: "health test prompt",
        }),
      }),
      env
    );

    // Check health report
    const healthRes = await app.fetch(makeRequest("/ai/health"), env);
    const healthData = await healthRes.json();
    expect(healthData.success).toBe(true);
    expect(healthData.data.models).toBeDefined();
  });
});

// ============================================================
// [7.4] RATE LIMIT (429) & QUOTA EXCEEDED (402) FAILOVER
// Tests that the failover engine correctly handles rate-limited
// and quota-exhausted models by falling through to next model
// ============================================================

describe("nexus-ai: Rate Limit & Quota Failover", () => {
  it("falls through to Workers AI when all external models return 429", async () => {
    const db = createMockD1();
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0 },
    });

    const kv = createMockKV();
    kv.get = vi.fn().mockResolvedValue(null) as MockKVNamespace["get"];

    const ai = {
      run: vi.fn().mockResolvedValue({
        response: "Workers AI recovered after 429s",
      }),
    };

    // Provide API keys so external models are attempted (and fail with 429)
    const env = buildEnv({
      DB: db,
      KV: kv,
      AI: ai,
      DEEPSEEK_API_KEY: "test-key",
      SILICONFLOW_API_KEY: "test-key",
    });

    // Mock global fetch to return 429 for all external calls
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    });

    try {
      const res = await app.fetch(
        makeRequest("/ai/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskType: "writing",
            prompt: "test rate limit failover",
          }),
        }),
        env
      );

      expect(res.status).toBe(200);
      const data = await res.json() as TestApiResponse;
      expect(data.success).toBe(true);
      // Workers AI should have been called as fallback
      expect(ai.run).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls through to Workers AI when external models return 402 quota exceeded", async () => {
    const db = createMockD1();
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0 },
    });

    const kv = createMockKV();
    kv.get = vi.fn().mockResolvedValue(null) as MockKVNamespace["get"];

    const ai = {
      run: vi.fn().mockResolvedValue({
        response: "Workers AI recovered after quota exceeded",
      }),
    };

    const env = buildEnv({
      DB: db,
      KV: kv,
      AI: ai,
      DEEPSEEK_API_KEY: "test-key",
      SILICONFLOW_API_KEY: "test-key",
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({ error: "QUOTA_EXCEEDED" }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    });

    try {
      const res = await app.fetch(
        makeRequest("/ai/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskType: "writing",
            prompt: "test quota exceeded failover",
          }),
        }),
        env
      );

      expect(res.status).toBe(200);
      const data = await res.json() as TestApiResponse;
      expect(data.success).toBe(true);
      expect(ai.run).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("model state is persisted to KV after rate limit", async () => {
    const db = createMockD1();
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0 },
    });

    const kv = createMockKV();
    kv.get = vi.fn().mockResolvedValue(null) as MockKVNamespace["get"];

    const ai = {
      run: vi.fn().mockResolvedValue({
        response: "Workers AI fallback after state persist",
      }),
    };

    // Use a less-tested task type ("seo") so models are fresh (not already rate-limited in memory)
    const env = buildEnv({
      DB: db,
      KV: kv,
      AI: ai,
      DATAFORSEO_KEY: "test-key",
      SERPAPI_KEY: "test-key",
      SILICONFLOW_API_KEY: "test-key",
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    });

    try {
      await app.fetch(
        makeRequest("/ai/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskType: "seo",
            prompt: "test state persistence for seo task",
          }),
        }),
        env
      );

      // KV.put should have been called to persist model state
      expect(kv.put).toHaveBeenCalled();
      // Verify a model_state: key was persisted
      const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
      const stateKeys = putCalls.filter(
        (call: unknown[]) => typeof call[0] === "string" && call[0].startsWith("model_state:")
      );
      expect(stateKeys.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================
// WORKERS AI — always last fallback, never fails
// ============================================================

describe("nexus-ai: Workers AI Fallback", () => {
  it("Workers AI is always the last model in every text-based chain", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/ai/registry"), env);
    const data = await res.json() as TestApiResponse;

    // Text-based chains always end with Workers AI
    const textChains = ["research", "writing", "copywriting", "seo", "seo_formatting", "social"];
    for (const taskType of textChains) {
      const models = data.data.registry[taskType];
      if (models && models.length > 0) {
        const lastModel = models[models.length - 1];
        expect(lastModel.isWorkersAI).toBe(true);
      }
    }
  });

  it("image chains end with Workers AI image model", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/ai/registry"), env);
    const data = await res.json() as TestApiResponse;

    const imageChains = ["text_on_image", "artistic_image"];
    for (const taskType of imageChains) {
      const models = data.data.registry[taskType];
      if (models && models.length > 0) {
        const lastModel = models[models.length - 1];
        expect(lastModel.isWorkersAI).toBe(true);
      }
    }
  });
});
