// ============================================================
// Integration Tests — nexus-variation Worker
// Tests: Platform variants, social content, humanizer
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApiResponse } from "@nexus/shared";
import app from "../../apps/workers/nexus-variation/src/index";
import {
  createMockFetcher,
  createMockKV,
  jsonResponse,
} from "../helpers/mocks";

/** Typed API response for test assertions (replaces Record<string, any>) */
interface TestApiResponse extends ApiResponse<Record<string, unknown>> {
  service?: string;
  status?: string;
}

function buildEnv(overrides: Record<string, unknown> = {}) {
  const aiFetcher = createMockFetcher(async (req) => {
    // The social engine and platform engine call NEXUS_AI at /ai/run
    // Parse the body to determine taskType
    let body: { taskType?: string; prompt?: string } = {};
    try {
      body = await req.json() as { taskType: string; prompt: string };
    } catch {
      // ignore parse errors
    }

    // Return social content (the social engine uses taskType: "social")
    if (body.taskType === "social") {
      return jsonResponse({
        success: true,
        data: {
          result: JSON.stringify({
            caption: "Check out our new candle! #handmade #soy",
            hashtags: ["candle", "handmade"],
            content_type: "carousel",
            notes: "Great for engagement",
          }),
          model: "test-model",
          cached: false,
          tokens: 80,
        },
      });
    }

    // Default: return platform variant JSON (used by platform engine)
    return jsonResponse({
      success: true,
      data: {
        result: JSON.stringify({
          title: "Handcrafted Soy Candle - Lavender Dreams",
          description: "Light up your space with our hand-poured soy candle.",
          tags: ["candle", "soy", "lavender", "handmade", "gift"],
          price: 24.99,
          cta: "Add to favorites",
          notes: "Perfect for the Etsy audience",
        }),
        model: "test-model",
        cached: false,
        tokens: 120,
      },
    });
  });

  const storageFetcher = createMockFetcher(async (req) => {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/kv/")) {
      // Return 404 for KV lookups (fall through to defaults)
      return jsonResponse({ success: false, error: "Key not found" }, 404);
    }
    return jsonResponse({ success: true, data: {} });
  });

  return {
    KV: createMockKV(),
    NEXUS_AI: aiFetcher,
    NEXUS_STORAGE: storageFetcher,
    ...overrides,
  };
}

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const sampleBaseProduct = {
  name: "Lavender Soy Candle",
  description: "A hand-poured soy candle with natural lavender essential oil.",
  features: ["100% soy wax", "Natural lavender oil", "40-hour burn time"],
  benefits: ["Relaxation", "Natural scent", "Eco-friendly"],
  tags: ["candle", "soy", "lavender"],
  price: 24.99,
  keywords: ["soy candle", "lavender candle", "handmade candle"],
  niche: "Home fragrance",
  category: "Candles",
};

// ============================================================
// HEALTH & INFO
// ============================================================

describe("nexus-variation: Health & Info", () => {
  it("GET / returns service info", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data).toHaveProperty("service", "nexus-variation");
  });

  it("GET /health returns healthy", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/health"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.status).toBe("healthy");
  });
});

// ============================================================
// PLATFORM VARIANTS — respects character limits
// ============================================================

describe("nexus-variation: Platform variants", () => {
  it("POST /variation/platform generates single variant", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseProduct: sampleBaseProduct,
          platformId: "etsy",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("variant");
    expect(data.data.variant).toHaveProperty("title");
    expect(data.data.variant).toHaveProperty("description");
    expect(data.data.variant).toHaveProperty("tags");
    expect(data.data).toHaveProperty("validation");
  });

  it("POST /variation/platform respects Etsy title char limit (140)", async () => {
    // Return a title that's too long — validation should truncate it
    const aiFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: {
          result: JSON.stringify({
            title: "A".repeat(200), // Exceeds 140 char limit
            description: "Test description",
            tags: Array.from({ length: 15 }, (_, i) => `tag${i}`), // Exceeds 13 tag limit
            price: 24.99,
            cta: "Buy now",
            notes: "",
          }),
          model: "test-model",
          cached: false,
          tokens: 100,
        },
      });
    });

    const env = buildEnv({ NEXUS_AI: aiFetcher });

    const res = await app.fetch(
      makeRequest("/variation/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseProduct: sampleBaseProduct,
          platformId: "etsy",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    const variant = (data.data as Record<string, Record<string, unknown>>).variant;
    const validation = (data.data as Record<string, Record<string, unknown>>).validation;
    // Title should be truncated to 140
    expect((variant.title as string).length).toBeLessThanOrEqual(140);
    // Tags should be truncated to 13 for Etsy
    expect((variant.tags as string[]).length).toBeLessThanOrEqual(13);
    // Validation should have issues
    expect((validation.issues as unknown[]).length).toBeGreaterThan(0);
  });

  it("POST /variation/platforms generates multiple variants", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseProduct: sampleBaseProduct,
          platformIds: ["etsy", "gumroad", "shopify"],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("total", 3);
    expect((data.data as Record<string, unknown>).succeeded).toBeGreaterThan(0);
  });

  it("POST /variation/platform returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseProduct: sampleBaseProduct }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /variation/platforms returns 400 for empty platformIds", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseProduct: sampleBaseProduct,
          platformIds: [],
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });
});

// ============================================================
// SOCIAL CONTENT — matches channel format
// ============================================================

describe("nexus-variation: Social content", () => {
  it("POST /variation/social generates single channel content", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseProduct: sampleBaseProduct,
          channelId: "instagram",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("content");
    expect(data.data).toHaveProperty("model");
  });

  it("POST /variation/socials generates multi-channel content", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseProduct: sampleBaseProduct,
          channelIds: ["instagram", "tiktok", "pinterest"],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("total", 3);
  });

  it("POST /variation/social returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseProduct: sampleBaseProduct }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /variation/socials returns 400 for empty channelIds", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseProduct: sampleBaseProduct,
          channelIds: [],
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });
});

// ============================================================
// HUMANIZER — removes AI patterns
// ============================================================

describe("nexus-variation: Humanizer", () => {
  it("POST /variation/humanize humanizes AI-generated text", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            "In today's fast-paced world, it's no secret that leverage and synergy are game-changers. Furthermore, this revolutionary product will supercharge your workflow.",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("original");
    expect(data.data).toHaveProperty("humanized");
    expect(data.data).toHaveProperty("human_score");
    expect(data.data).toHaveProperty("patterns_found");
    // Should detect AI patterns
    expect(((data.data as Record<string, unknown>).patterns_found as unknown[]).length).toBeGreaterThan(0);
  });

  it("POST /variation/humanize skips already-human text", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            "I made this candle by hand last Tuesday. It smells like lavender and burns for about 40 hours. Pretty simple, but people love it. The wax is soy-based, and I source the essential oils from a local farm. Each one's a little different -- that's part of the charm.",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    // Already human text should pass through with high score
    expect((data.data as Record<string, unknown>).human_score).toBeGreaterThanOrEqual(85);
  });

  it("POST /variation/humanize returns 400 for missing content", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /variation/humanize-product humanizes all product fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/humanize-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: {
            name: "Test Product",
            title:
              "In today's digital age, this game-changer will revolutionize your workflow with cutting-edge innovation.",
            description:
              "Furthermore, this robust solution leverages synergy to supercharge your productivity. Needless to say, it's a paradigm shift.",
          },
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("name");
    expect(data.data).toHaveProperty("overall_human_score");
  });

  it("POST /variation/humanize-product returns 400 for missing product", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/variation/humanize-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });
});
