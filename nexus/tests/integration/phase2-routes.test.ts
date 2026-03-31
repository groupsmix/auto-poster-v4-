// ============================================================
// Integration Tests — Phase 2/3 Feature Routes
// [7.3] Scheduler, Campaigns, Revenue, ROI, Recycler,
//       Localization, Chatbot, Project Builder, Briefings
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import app, { rateLimitMap } from "../../apps/workers/nexus-router/src/index";
import type { ApiResponse } from "@nexus/shared";
import {
  createMockFetcher,
  createMockKV,
  jsonResponse,
} from "../helpers/mocks";

/** Typed API response for test assertions */
interface TestApiResponse extends ApiResponse<Record<string, unknown>> {
  total?: number;
  page?: number;
  pageSize?: number;
}

// Clear the in-memory rate limiter between tests
beforeEach(() => {
  rateLimitMap.clear();
});

function buildEnv(overrides: Record<string, unknown> = {}) {
  const storageFetcher = createMockFetcher(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/d1/query") {
      return jsonResponse({ success: true, data: [] });
    }
    if (url.pathname.startsWith("/cleanup/")) {
      return jsonResponse({
        success: true,
        data: { deleted: { d1: 1, r2: 0, kv: 0, images: 0 }, errors: [] },
      });
    }
    return jsonResponse({ success: true, data: {} });
  });

  const workflowFetcher = createMockFetcher(async () =>
    jsonResponse({
      success: true,
      data: { product_id: "p1", run_id: "r1", status: "running" },
    })
  );

  const variationFetcher = createMockFetcher(async () =>
    jsonResponse({ success: true, data: { variants: [], errors: [] } })
  );

  const aiFetcher = createMockFetcher(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/ai/chatbot/chat") {
      return jsonResponse({
        success: true,
        data: {
          content: "I can help you with that!",
          actions: [],
        },
      });
    }
    if (url.pathname === "/ai/briefing/generate") {
      return jsonResponse({
        success: true,
        data: {
          title: "Daily Briefing",
          summary: "Summary of today",
          sections: [{ type: "trends", content: "Trending up" }],
          domains_analyzed: ["digital-products"],
          ai_model_used: "deepseek-v3",
          tokens_used: 500,
        },
      });
    }
    return jsonResponse({ success: true, data: {} });
  });

  return {
    NEXUS_STORAGE: storageFetcher,
    NEXUS_WORKFLOW: workflowFetcher,
    NEXUS_VARIATION: variationFetcher,
    NEXUS_AI: aiFetcher,
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
  return new Request(`http://localhost${path}`, { ...init, headers });
}

// ============================================================
// SCHEDULER ROUTES
// ============================================================

describe("nexus-router: Scheduler Routes", () => {
  it("GET /api/schedules returns list", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/schedules"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/schedules/:id returns a schedule", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/schedules/sched-1"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/schedules creates a schedule", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Daily Products",
          domain_id: "dom-1",
          interval_hours: 24,
          products_per_run: 3,
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/schedules returns 400 for missing name", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: "dom-1" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/schedules returns 400 for missing domain_id", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Schedule" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/schedules returns 400 for invalid interval_hours", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bad Interval",
          domain_id: "dom-1",
          interval_hours: 0,
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/schedules returns 400 for invalid products_per_run", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bad Products",
          domain_id: "dom-1",
          products_per_run: -1,
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("PUT /api/schedules/:id updates a schedule", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules/sched-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_hours: 12 }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("DELETE /api/schedules/:id deletes a schedule", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules/sched-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("deleted", "sched-1");
  });

  it("POST /api/schedules/:id/toggle toggles schedule", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules/sched-1/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/schedules/:id/runs returns run history", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules/sched-1/runs"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/schedules/tick executes due schedules", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules/tick", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// CAMPAIGN ROUTES
// ============================================================

describe("nexus-router: Campaign Routes", () => {
  it("GET /api/campaigns returns list", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/campaigns"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/campaigns/:id returns a campaign", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/campaigns/camp-1"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/campaigns creates a campaign", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Holiday Launch",
          domain_id: "dom-1",
          target_count: 20,
          deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/campaigns returns 400 for missing required fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Incomplete" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/campaigns returns 400 for target_count < 1", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bad Count",
          domain_id: "dom-1",
          target_count: 0,
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/campaigns returns 400 for past deadline", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Past Deadline",
          domain_id: "dom-1",
          target_count: 10,
          deadline: "2020-01-01T00:00:00Z",
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("PUT /api/campaigns/:id updates a campaign", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns/camp-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_count: 30 }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("DELETE /api/campaigns/:id deletes a campaign", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns/camp-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("deleted", "camp-1");
  });

  it("GET /api/campaigns/:id/progress returns progress", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns/camp-1/progress"),
      env
    );
    // Returns 200 with data or 404 if not found
    expect([200, 404]).toContain(res.status);
  });

  it("POST /api/campaigns/:id/execute executes a batch", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns/camp-1/execute", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// REVENUE ROUTES
// ============================================================

describe("nexus-router: Revenue Routes", () => {
  it("GET /api/revenue/connections returns list", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/connections"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/revenue/connections creates a connection", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "etsy" }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/revenue/connections returns 400 for missing platform", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("DELETE /api/revenue/connections/:id deletes a connection", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/connections/conn-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/revenue/records creates a revenue record", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: "conn-1",
          platform: "etsy",
          revenue: 49.99,
          order_date: "2026-03-15T00:00:00Z",
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/revenue/records returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "etsy" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/revenue/records returns 400 for negative revenue", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: "conn-1",
          platform: "etsy",
          revenue: -10,
          order_date: "2026-03-15",
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/revenue/records/bulk adds multiple records", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: [
            { connection_id: "c1", platform: "etsy", revenue: 10, order_date: "2026-03-01" },
            { connection_id: "c1", platform: "etsy", revenue: 20, order_date: "2026-03-02" },
          ],
        }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/revenue/records/bulk returns 400 for empty records", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: [] }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/revenue/import/csv parses CSV data", async () => {
    const env = buildEnv();
    const csv = "revenue,order_date\n49.99,2026-03-15\n29.99,2026-03-16";
    const res = await app.fetch(
      makeRequest("/api/revenue/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: "conn-1",
          platform: "etsy",
          csv,
        }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/revenue/import/csv returns 400 for missing columns", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: "conn-1",
          platform: "etsy",
          csv: "name,price\nWidget,10",
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/revenue/dashboard returns dashboard data", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/dashboard"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/revenue/products/:productId returns product revenue", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/products/prod-1"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// ROI ROUTES
// ============================================================

describe("nexus-router: ROI Routes", () => {
  it("GET /api/roi/costs returns niche costs", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/roi/costs"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/roi/costs adds a niche cost", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/roi/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: "dom-1", amount: 25.50 }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/roi/costs returns 400 for missing domain_id", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/roi/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10 }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/roi/costs returns 400 for negative amount", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/roi/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: "dom-1", amount: -5 }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("DELETE /api/roi/costs/:id deletes a niche cost", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/roi/costs/cost-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/roi/snapshots creates an ROI snapshot", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/roi/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_id: "dom-1",
          period_start: "2026-01-01",
          period_end: "2026-03-31",
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/roi/snapshots returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/roi/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: "dom-1" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/roi/reports generates an ROI report", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/roi/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: "2026-01-01",
          period_end: "2026-03-31",
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/roi/reports lists ROI reports", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/roi/reports"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/roi/dashboard returns ROI dashboard", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/roi/dashboard"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// RECYCLER ROUTES
// ============================================================

describe("nexus-router: Recycler Routes", () => {
  it("GET /api/recycler/top-sellers returns top sellers", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/top-sellers"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/recycler/analyze/:productId analyzes a product", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/analyze/prod-1"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/recycler/jobs lists recycler jobs", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/recycler/jobs"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/recycler/jobs creates a recycler job", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_product_id: "prod-1",
          strategy: "niche-pivot",
          variations_requested: 3,
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/recycler/jobs returns 400 for missing source_product_id", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: "niche-pivot" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("DELETE /api/recycler/jobs/:id deletes a job", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/jobs/job-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/recycler/jobs/:id/generate generates variations", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/jobs/job-1/generate", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/recycler/jobs/:id/variations lists variations", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/jobs/job-1/variations"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// LOCALIZATION ROUTES
// ============================================================

describe("nexus-router: Localization Routes", () => {
  it("GET /api/localization/languages returns available languages", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/languages"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/localization/candidates returns candidates", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/candidates"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/localization/jobs lists localization jobs", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/localization/jobs creates a localization job", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_product_id: "prod-1",
          languages: ["fr", "de", "es"],
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/localization/jobs returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_product_id: "prod-1" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/localization/jobs returns 400 for empty languages", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_product_id: "prod-1",
          languages: [],
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("DELETE /api/localization/jobs/:id deletes a job", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs/loc-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/localization/jobs/:id/execute executes localization", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs/loc-1/execute", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/localization/jobs/:id/products lists localized products", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs/loc-1/products"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// CHATBOT ROUTES
// ============================================================

describe("nexus-router: Chatbot Routes", () => {
  it("POST /api/chatbot/chat sends a message and gets response", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "How many products do I have?" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("conversation_id");
    expect(data.data).toHaveProperty("message");
  });

  it("POST /api/chatbot/chat returns 400 for empty message", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/chatbot/chat returns 400 for message exceeding 4000 chars", async () => {
    const env = buildEnv();
    const longMessage = "a".repeat(4001);
    const res = await app.fetch(
      makeRequest("/api/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: longMessage }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as TestApiResponse;
    expect(data.error).toContain("4000");
  });

  it("POST /api/chatbot/execute returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/chatbot/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/chatbot/history returns conversation list", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/chatbot/history"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("DELETE /api/chatbot/history/:id deletes a conversation", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/chatbot/history/conv-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("deleted", "conv-1");
  });
});

// ============================================================
// PROJECT BUILDER ROUTES
// ============================================================

describe("nexus-router: Project Builder Routes", () => {
  it("POST /api/project-builder creates a build", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: "AI-powered resume builder",
          tech_stack: "Next.js + Tailwind",
          features: ["PDF export", "AI suggestions"],
        }),
      }),
      env
    );
    expect([200, 201]).toContain(res.status);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/project-builder returns 400 for missing idea", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/project-builder lists builds", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/project-builder/:buildId/rebuild returns 400 for missing feedback", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder/build-1/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/project-builder/:buildId/cancel cancels a build", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder/build-1/cancel", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("DELETE /api/project-builder/:buildId deletes a build", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder/build-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });
});

// ============================================================
// BRIEFING ROUTES
// ============================================================

describe("nexus-router: Briefing Routes", () => {
  it("GET /api/briefings returns list", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/briefings"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/briefings/settings returns settings", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/d1/query") {
        return jsonResponse({ success: true, data: [] });
      }
      return jsonResponse({ success: true, data: {} });
    });
    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/briefings/settings"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    // Should return defaults when no settings exist
    expect(data.data).toHaveProperty("briefing_hour");
  });

  it("PUT /api/briefings/settings updates settings", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/briefings/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefing_hour: 9,
          briefing_enabled: true,
          user_timezone: "America/New_York",
        }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("PUT /api/briefings/settings returns 400 for invalid hour", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/briefings/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing_hour: 25 }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("PUT /api/briefings/settings returns 400 for no fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/briefings/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("DELETE /api/briefings/:id deletes a briefing", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/briefings/brief-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("deleted", "brief-1");
  });

  it("POST /api/briefings/generate generates a briefing", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/d1/query") {
        return jsonResponse({ success: true, data: [] });
      }
      return jsonResponse({ success: true, data: {} });
    });

    const aiFetcher = createMockFetcher(async () =>
      jsonResponse({
        success: true,
        data: {
          title: "Daily Briefing",
          summary: "Today's market summary",
          sections: [{ type: "trends", content: "Trending products" }],
          domains_analyzed: ["digital-products"],
          ai_model_used: "deepseek-v3",
          tokens_used: 800,
        },
      })
    );

    const env = buildEnv({
      NEXUS_STORAGE: storageFetcher,
      NEXUS_AI: aiFetcher,
    });

    const res = await app.fetch(
      makeRequest("/api/briefings/generate", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("title");
    expect(data.data).toHaveProperty("sections");
  });

  it("GET /api/briefings/latest returns 404 when no briefings exist", async () => {
    const storageFetcher = createMockFetcher(async (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/d1/query") {
        return jsonResponse({ success: true, data: [] });
      }
      return jsonResponse({ success: true, data: {} });
    });
    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/briefings/latest"),
      env
    );
    expect(res.status).toBe(404);
  });
});
