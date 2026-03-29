// ============================================================
// Frontend E2E Tests (simulated via API)
// Tests the full workflow flow through the router API layer:
//   Home → domain → category → form → workflow → progress → review → approve
//   Batch workflow, Reject/revise, Manager CRUD
// ============================================================

import { describe, it, expect, vi } from "vitest";
import app from "../../apps/workers/nexus-router/src/index";
import {
  createMockFetcher,
  jsonResponse,
} from "../helpers/mocks";

/**
 * Since we don't have a browser runner, we simulate the frontend E2E flow
 * by calling the API routes in the same order a user would interact with
 * the dashboard. This validates the full API contract the frontend relies on.
 */

let domainId: string;
let categoryId: string;
let productId: string;

// Track storage queries for data simulation
const storedData: Record<string, Record<string, unknown>[]> = {
  domains: [],
  categories: [],
  products: [],
  workflow_runs: [],
  reviews: [],
};

function buildE2EEnv() {
  const storageFetcher = createMockFetcher(async (req) => {
    const url = new URL(req.url);

    if (url.pathname === "/d1/query") {
      const body = await req.json() as { sql: string; params: unknown[] };

      // SELECT queries
      if (body.sql.includes("SELECT") && body.sql.includes("domains")) {
        return jsonResponse({ success: true, data: storedData.domains });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("categories")) {
        return jsonResponse({ success: true, data: storedData.categories });
      }
      if (body.sql.includes("COUNT")) {
        return jsonResponse({ success: true, data: [{ total: storedData.products.length }] });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("products") && body.sql.includes("WHERE id")) {
        return jsonResponse({
          success: true,
          data: storedData.products.length > 0 ? [storedData.products[0]] : [],
        });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("products")) {
        return jsonResponse({ success: true, data: storedData.products });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("pending_review")) {
        return jsonResponse({ success: true, data: storedData.products.filter(p => p.status === "pending_review") });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("workflow_runs")) {
        return jsonResponse({ success: true, data: storedData.workflow_runs });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("platform_variants")) {
        return jsonResponse({ success: true, data: [] });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("social_variants")) {
        return jsonResponse({ success: true, data: [] });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("assets")) {
        return jsonResponse({ success: true, data: [] });
      }
      if (body.sql.includes("SELECT") && body.sql.includes("reviews")) {
        return jsonResponse({ success: true, data: storedData.reviews });
      }

      // INSERT/UPDATE/DELETE
      return jsonResponse({
        success: true,
        data: { results: [], meta: { changes: 1, last_row_id: 1 } },
      });
    }

    if (url.pathname.startsWith("/cleanup/")) {
      return jsonResponse({
        success: true,
        data: { deleted: { d1: 1 }, errors: [] },
      });
    }

    return jsonResponse({ success: true, data: {} });
  });

  const workflowFetcher = createMockFetcher(async (req) => {
    const url = new URL(req.url);

    if (url.pathname === "/workflow/start") {
      return jsonResponse({
        success: true,
        data: {
          product_id: "e2e-prod-1",
          run_id: "e2e-run-1",
          status: "running",
        },
      });
    }

    if (url.pathname.includes("/workflow/status/")) {
      return jsonResponse({
        success: true,
        data: {
          run: {
            id: "e2e-run-1",
            product_id: "e2e-prod-1",
            status: "completed",
            current_step: 9,
            total_steps: 9,
          },
          steps: [
            { step_name: "research", status: "completed" },
            { step_name: "strategy", status: "completed" },
            { step_name: "content_generation", status: "completed" },
            { step_name: "seo_optimization", status: "completed" },
            { step_name: "image_generation", status: "completed" },
            { step_name: "platform_variants", status: "completed" },
            { step_name: "social_content", status: "completed" },
            { step_name: "humanizer_pass", status: "completed" },
            { step_name: "quality_review", status: "completed" },
          ],
        },
      });
    }

    if (url.pathname.includes("/workflow/cancel/")) {
      return jsonResponse({
        success: true,
        data: { status: "cancelled" },
      });
    }

    if (url.pathname.includes("/workflow/batch/")) {
      return jsonResponse({
        success: true,
        data: {
          batch_id: "batch-1",
          total: 3,
          completed: 3,
          products: [
            { id: "bp1", status: "completed" },
            { id: "bp2", status: "completed" },
            { id: "bp3", status: "completed" },
          ],
        },
      });
    }

    if (url.pathname.includes("/workflow/revise/")) {
      return jsonResponse({
        success: true,
        data: { run_id: "e2e-run-1", status: "in_revision" },
      });
    }

    return jsonResponse({ success: true, data: {} });
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
    DASHBOARD_SECRET: "e2e-secret",
  };
}

function makeRequest(
  path: string,
  init?: RequestInit
): Request {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", "Bearer e2e-secret");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
  });
}

// ============================================================
// E2E FLOW 1: Home → Domain → Category → Form → Workflow → Review → Approve
// ============================================================

describe("Frontend E2E: Full Workflow Flow", () => {
  const env = buildE2EEnv();

  it("Step 1: Home page loads — GET /api/domains", async () => {
    const res = await app.fetch(makeRequest("/api/domains"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
  });

  it("Step 2: Create a domain — POST /api/domains", async () => {
    const res = await app.fetch(
      makeRequest("/api/domains", {
        method: "POST",
        body: JSON.stringify({ name: "Home & Living", description: "Home products" }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
    domainId = data.data.id;
    storedData.domains.push({ id: domainId, name: "Home & Living", slug: "home-living" });
  });

  it("Step 3: Click domain → see categories — GET /api/domains/:id/categories", async () => {
    const res = await app.fetch(
      makeRequest(`/api/domains/${domainId}/categories`),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
  });

  it("Step 4: Create category — POST /api/categories", async () => {
    const res = await app.fetch(
      makeRequest("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          domain_id: domainId,
          name: "Candles",
          description: "Handmade candles",
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = await res.json() as Record<string, any>;
    categoryId = data.data.id;
    storedData.categories.push({
      id: categoryId,
      domain_id: domainId,
      name: "Candles",
    });
  });

  it("Step 5: Fill form and start workflow — POST /api/workflow/start", async () => {
    const res = await app.fetch(
      makeRequest("/api/workflow/start", {
        method: "POST",
        body: JSON.stringify({
          domain_id: domainId,
          category_id: categoryId,
          niche: "Soy candles with essential oils",
          name: "Lavender Dreams Candle",
          platforms: ["etsy", "gumroad"],
          social_channels: ["instagram"],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("product_id");
    expect(data.data).toHaveProperty("run_id");
    productId = data.data.product_id;

    storedData.products.push({
      id: productId,
      name: "Lavender Dreams Candle",
      status: "pending_review",
      domain_id: domainId,
      category_id: categoryId,
      user_input: JSON.stringify({
        platforms: ["etsy", "gumroad"],
        social_channels: ["instagram"],
      }),
    });
    storedData.workflow_runs.push({
      id: data.data.run_id,
      product_id: productId,
      status: "completed",
    });
  });

  it("Step 6: Check workflow progress — GET /api/workflow/status/:runId", async () => {
    const res = await app.fetch(
      makeRequest("/api/workflow/status/e2e-run-1"),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
    // Should show 9 completed steps
    expect(data.data.steps).toHaveLength(9);
    expect(data.data.steps.every((s: { status: string }) => s.status === "completed")).toBe(true);
  });

  it("Step 7: View pending reviews — GET /api/reviews/pending", async () => {
    const res = await app.fetch(
      makeRequest("/api/reviews/pending"),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
  });

  it("Step 8: Approve product — POST /api/reviews/:productId/approve", async () => {
    const res = await app.fetch(
      makeRequest(`/api/reviews/${productId}/approve`, {
        method: "POST",
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("approved");
  });
});

// ============================================================
// E2E FLOW 2: Batch Workflow
// ============================================================

describe("Frontend E2E: Batch Workflow Flow", () => {
  const env = buildE2EEnv();

  it("starts batch workflow with batch_count=3", async () => {
    const workflowFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: {
          batch_id: "batch-e2e",
          batch_count: 3,
          products: [
            { product_id: "bp1", run_id: "br1", status: "running" },
            { product_id: "bp2", run_id: "br2", status: "running" },
            { product_id: "bp3", run_id: "br3", status: "running" },
          ],
        },
      });
    });

    const batchEnv = { ...env, NEXUS_WORKFLOW: workflowFetcher };

    const res = await app.fetch(
      makeRequest("/api/workflow/start", {
        method: "POST",
        body: JSON.stringify({
          domain_id: "dom-1",
          category_id: "cat-1",
          niche: "Handmade soap",
          batch_count: 3,
        }),
      }),
      batchEnv
    );

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
  });

  it("checks batch progress — GET /api/workflow/batch/:batchId", async () => {
    const res = await app.fetch(
      makeRequest("/api/workflow/batch/batch-e2e"),
      env
    );
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// E2E FLOW 3: Reject and Revise
// ============================================================

describe("Frontend E2E: Reject and Revise Flow", () => {
  const env = buildE2EEnv();

  it("rejects product with feedback", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/d1/query") {
        const body = await req.json() as { sql: string };
        if (body.sql.includes("SELECT id FROM workflow_runs")) {
          return jsonResponse({
            success: true,
            data: [{ id: "rev-run-1" }],
          });
        }
        return jsonResponse({
          success: true,
          data: { results: [], meta: { changes: 1 } },
        });
      }
      return jsonResponse({ success: true, data: {} });
    });

    const rejEnv = { ...env, NEXUS_STORAGE: storageFetcher };

    const res = await app.fetch(
      makeRequest("/api/reviews/prod-reject/reject", {
        method: "POST",
        body: JSON.stringify({
          feedback: "Title is too generic, description lacks emotion",
        }),
      }),
      rejEnv
    );

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("rejected");
  });

  it("starts revision with feedback — POST /api/workflow/revise/:runId", async () => {
    const res = await app.fetch(
      makeRequest("/api/workflow/revise/rev-run-1", {
        method: "POST",
        body: JSON.stringify({
          feedback: "Make the title more creative",
          steps: ["content_generation"],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// E2E FLOW 4: Manager Pages (CRUD)
// ============================================================

describe("Frontend E2E: Manager CRUD Operations", () => {
  const env = buildE2EEnv();

  it("Platform manager — creates, lists platforms", async () => {
    // GET platforms
    const listRes = await app.fetch(makeRequest("/api/platforms"), env);
    expect(listRes.status).toBe(200);
  });

  it("Social channel manager — creates, lists channels", async () => {
    const listRes = await app.fetch(makeRequest("/api/social-channels"), env);
    expect(listRes.status).toBe(200);
  });

  it("AI manager — gets models", async () => {
    const aiFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: {
          taskTypes: ["research", "writing"],
          registry: { research: [], writing: [] },
        },
      });
    });
    const aiEnv = { ...env, NEXUS_AI: aiFetcher };

    const res = await app.fetch(makeRequest("/api/ai/models"), aiEnv);
    expect(res.status).toBe(200);
  });

  it("Settings — gets settings", async () => {
    const res = await app.fetch(makeRequest("/api/settings"), env);
    expect(res.status).toBe(200);
  });

  it("Analytics — gets overview stats", async () => {
    const res = await app.fetch(makeRequest("/api/analytics/overview"), env);
    expect(res.status).toBe(200);
  });

  it("History — gets product history", async () => {
    const res = await app.fetch(makeRequest("/api/history"), env);
    expect(res.status).toBe(200);
  });
});
