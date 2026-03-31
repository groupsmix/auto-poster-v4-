// ============================================================
// Integration Tests — nexus-router Worker
// Tests: API routes, auth middleware, delete synced cleanup
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../apps/workers/nexus-router/src/index";
import type { ApiResponse } from "@nexus/shared";
import {
  createMockFetcher,
  createMockKV,
  jsonResponse,
} from "../helpers/mocks";

/** Typed API response for test assertions (replaces Record<string, any>) */
interface TestApiResponse extends ApiResponse<Record<string, unknown>> {
  total?: number;
  page?: number;
  pageSize?: number;
  service?: string;
  status?: string;
}

function buildEnv(overrides: Record<string, unknown> = {}) {
  const storageFetcher = createMockFetcher(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/d1/query") {
      return jsonResponse({
        success: true,
        data: [],
      });
    }
    if (url.pathname.startsWith("/cleanup/")) {
      return jsonResponse({
        success: true,
        data: {
          deleted: { d1: 1, r2: 0, kv: 0, images: 0 },
          errors: [],
        },
      });
    }
    return jsonResponse({ success: true, data: {} });
  });

  const workflowFetcher = createMockFetcher(async () => {
    return jsonResponse({
      success: true,
      data: { product_id: "p1", run_id: "r1", status: "running" },
    });
  });

  const variationFetcher = createMockFetcher(async () => {
    return jsonResponse({
      success: true,
      data: { variants: [], errors: [] },
    });
  });

  return {
    NEXUS_STORAGE: storageFetcher,
    NEXUS_WORKFLOW: workflowFetcher,
    NEXUS_VARIATION: variationFetcher,
    NEXUS_AI: createMockFetcher(),
    DASHBOARD_SECRET: "test-secret-123",
    ...overrides,
  };
}

function makeRequest(
  path: string,
  init?: RequestInit,
  auth = true
): Request {
  const headers = new Headers(init?.headers ?? {});
  if (auth) {
    headers.set("Authorization", "Bearer test-secret-123");
  }
  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
  });
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

describe("nexus-router: Auth Middleware", () => {
  it("blocks unauthenticated requests to /api/*", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/domains", {}, false),
      env
    );
    expect(res.status).toBe(401);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(false);
    expect(data.error).toContain("Authorization");
  });

  it("blocks requests with wrong auth token", async () => {
    const env = buildEnv();
    const req = new Request("http://localhost/api/domains", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(401);
  });

  it("allows authenticated requests", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/domains"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("returns 503 when DASHBOARD_SECRET is not configured", async () => {
    const env = buildEnv({ DASHBOARD_SECRET: undefined });
    const res = await app.fetch(
      makeRequest("/api/domains", {}, false),
      env
    );
    expect(res.status).toBe(503);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(false);
    expect(data.error).toContain("not configured");
  });

  it("allows public routes without auth (GET /)", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/", {}, false),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data).toHaveProperty("service", "nexus-router");
  });

  it("allows /health without auth", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/health", {}, false),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.status).toBe("ok");
  });
});

// ============================================================
// DOMAIN ROUTES
// ============================================================

describe("nexus-router: Domain Routes", () => {
  it("GET /api/domains returns list", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/domains"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/domains creates a domain", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Home & Living" }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("id");
    expect(data.data).toHaveProperty("slug");
  });

  it("POST /api/domains returns 400 for missing name", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("PUT /api/domains/:id updates a domain", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/domains/dom-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Domain" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("DELETE /api/domains/:id triggers synced cleanup", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/cleanup/domain/")) {
        return jsonResponse({
          success: true,
          data: {
            deleted: { d1: 3, r2: 1, kv: 2, images: 0 },
            errors: [],
          },
        });
      }
      return jsonResponse({ success: true, data: [] });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/domains/dom-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    // Verify storage cleanup was called
    expect(storageFetcher.fetch).toHaveBeenCalled();
  });
});

// ============================================================
// CATEGORY ROUTES
// ============================================================

describe("nexus-router: Category Routes", () => {
  it("GET /api/domains/:id/categories returns categories", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/domains/dom-1/categories"),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/categories creates a category", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: "dom-1",
          name: "Candles",
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/categories returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Candles" }), // missing domain_id
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("DELETE /api/categories/:id triggers cleanup", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/cleanup/")) {
        return jsonResponse({
          success: true,
          data: { deleted: { d1: 1 }, errors: [] },
        });
      }
      return jsonResponse({ success: true, data: [] });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/categories/cat-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
  });
});

// ============================================================
// PRODUCT ROUTES
// ============================================================

describe("nexus-router: Product Routes", () => {
  it("GET /api/products returns paginated list", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const body = await req.json() as { sql: string };
      if (body.sql.includes("COUNT")) {
        return jsonResponse({ success: true, data: [{ total: 5 }] });
      }
      return jsonResponse({
        success: true,
        data: [{ id: "p1", name: "Product 1", status: "draft" }],
      });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/products?page=1&pageSize=10"),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/products creates a draft product", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: "dom-1",
          category_id: "cat-1",
          name: "Test Product",
          niche: "handmade candles",
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("draft");
  });

  it("DELETE /api/products/:id triggers synced cleanup", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/cleanup/")) {
        return jsonResponse({
          success: true,
          data: { deleted: { d1: 1, r2: 0 }, errors: [] },
        });
      }
      return jsonResponse({ success: true, data: [] });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/products/prod-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
  });
});

// ============================================================
// WORKFLOW ROUTES — forwarded to nexus-workflow
// ============================================================

describe("nexus-router: Workflow Routes", () => {
  it("POST /api/workflow/start forwards to nexus-workflow", async () => {
    const workflowFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: { product_id: "p1", run_id: "r1", status: "running" },
      });
    });

    const env = buildEnv({ NEXUS_WORKFLOW: workflowFetcher });
    const res = await app.fetch(
      makeRequest("/api/workflow/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: "dom-1",
          category_id: "cat-1",
          niche: "Test niche",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(workflowFetcher.fetch).toHaveBeenCalled();
  });

  it("POST /api/workflow/start returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/workflow/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: "test" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/workflow/cancel/:runId cancels workflow", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/workflow/cancel/run-1", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/workflow/status/:runId gets status", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/workflow/status/run-1"),
      env
    );
    // Returns 200 or 404 depending on workflow existence
    expect([200, 404]).toContain(res.status);
  });
});

// ============================================================
// REVIEW ROUTES
// ============================================================

describe("nexus-router: Review Routes", () => {
  it("GET /api/reviews/pending returns pending reviews", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/reviews/pending"),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/reviews/:productId/approve approves product", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/d1/query") {
        const body = await req.json() as { sql: string };
        if (body.sql.includes("SELECT * FROM products")) {
          return jsonResponse({
            success: true,
            data: [
              {
                id: "p1",
                name: "Test",
                niche: "test",
                domain_id: "d1",
                category_id: "c1",
                user_input: JSON.stringify({ platforms: [], social_channels: [] }),
              },
            ],
          });
        }
        return jsonResponse({
          success: true,
          data: { results: [], meta: { changes: 1 } },
        });
      }
      return jsonResponse({ success: true, data: {} });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/reviews/p1/approve", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/reviews/:productId/reject requires feedback", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/reviews/p1/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
    const data = await res.json() as TestApiResponse;
    expect(data.error).toContain("feedback");
  });

  it("POST /api/reviews/:productId/reject with feedback succeeds", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/d1/query") {
        const body = await req.json() as { sql: string };
        if (body.sql.includes("SELECT id FROM workflow_runs")) {
          return jsonResponse({
            success: true,
            data: [{ id: "run-1" }],
          });
        }
        return jsonResponse({
          success: true,
          data: { results: [], meta: { changes: 1 } },
        });
      }
      return jsonResponse({ success: true, data: {} });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/reviews/p1/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: "Title needs improvement",
        }),
      }),
      env
    );
    expect(res.status).toBe(200);
  });
});

// ============================================================
// DELETE ROUTES TRIGGER SYNCED CLEANUP
// ============================================================

describe("nexus-router: Delete triggers synced cleanup", () => {
  it("DELETE /api/products/:id calls storage cleanup", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/cleanup/product/")) {
        return jsonResponse({
          success: true,
          data: {
            deleted: { d1: 5, r2: 2, kv: 3, images: 1 },
            errors: [],
          },
        });
      }
      return jsonResponse({ success: true, data: [] });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/products/prod-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data.success).toBe(true);

    // Verify the cleanup endpoint was called
    const calls = (storageFetcher.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const cleanupCalls = calls.filter((call: [string | Request]) => {
      const url = typeof call[0] === "string" ? call[0] : (call[0] as Request).url;
      return url.includes("/cleanup/");
    });
    expect(cleanupCalls.length).toBeGreaterThan(0);
  });
});
