// ============================================================
// Integration Tests — Phase 2/3 Route Coverage
// Tests: Schedules, Campaigns, Revenue, ROI, Recycler,
//        Localization, Chatbot, Project Builder, Briefings
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import app, { rateLimitMap } from "../../apps/workers/nexus-router/src/index";
import type { ApiResponse } from "@nexus/shared";
import { createMockFetcher, jsonResponse } from "../helpers/mocks";

/** Typed API response for test assertions */
interface TestApiResponse extends ApiResponse<Record<string, unknown>> {
  total?: number;
  page?: number;
  pageSize?: number;
}

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

  return {
    NEXUS_STORAGE: storageFetcher,
    NEXUS_WORKFLOW: createMockFetcher(),
    NEXUS_VARIATION: createMockFetcher(),
    NEXUS_AI: createMockFetcher(),
    DASHBOARD_SECRET: "test-secret-123",
    ...overrides,
  };
}

function makeRequest(path: string, init?: RequestInit, auth = true): Request {
  const headers = new Headers(init?.headers ?? {});
  if (auth) {
    headers.set("Authorization", "Bearer test-secret-123");
  }
  return new Request(`http://localhost${path}`, { ...init, headers });
}

// ============================================================
// SCHEDULER ROUTES
// ============================================================

describe("nexus-router: Schedule Routes (Phase 2)", () => {
  it("GET /api/schedules returns list", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/schedules"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/schedules/:id returns schedule", async () => {
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
          name: "Daily Candles",
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
        body: JSON.stringify({ name: "Test" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/schedules rejects invalid interval_hours", async () => {
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

  it("POST /api/schedules rejects invalid products_per_run", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bad Count",
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
        body: JSON.stringify({ name: "Updated Schedule" }),
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

describe("nexus-router: Campaign Routes (Phase 2)", () => {
  it("GET /api/campaigns returns list", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/campaigns"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/campaigns/:id returns campaign", async () => {
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
          name: "Q1 Sprint",
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
        body: JSON.stringify({ name: "Missing fields" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/campaigns rejects target_count < 1", async () => {
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

  it("POST /api/campaigns rejects past deadline", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Past Deadline",
          domain_id: "dom-1",
          target_count: 5,
          deadline: "2020-01-01T00:00:00Z",
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/campaigns rejects invalid deadline", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Invalid Date",
          domain_id: "dom-1",
          target_count: 5,
          deadline: "not-a-date",
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
        body: JSON.stringify({ name: "Updated Campaign" }),
      }),
      env
    );
    expect(res.status).toBe(200);
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

  it("POST /api/campaigns/:id/execute returns 500 when campaign not found", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns/camp-1/execute", { method: "POST" }),
      env
    );
    // Service throws "Campaign not found or not active" when DB is empty
    expect(res.status).toBe(500);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(false);
  });

  it("GET /api/campaigns/:id/progress returns 404 when campaign not found", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/campaigns/camp-1/progress"),
      env
    );
    // getCampaignProgress returns null for missing campaign → route returns 404
    expect(res.status).toBe(404);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(false);
  });
});

// ============================================================
// REVENUE ROUTES
// ============================================================

describe("nexus-router: Revenue Routes (Phase 2)", () => {
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
        body: JSON.stringify({ platform: "etsy", store_name: "My Etsy Shop" }),
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
        body: JSON.stringify({ store_name: "No Platform" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("DELETE /api/revenue/connections/:id deletes connection", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/connections/conn-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.data).toHaveProperty("deleted", "conn-1");
  });

  it("POST /api/revenue/records adds a revenue record", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: "conn-1",
          platform: "etsy",
          revenue: 29.99,
          order_date: "2026-03-15",
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
  });

  it("POST /api/revenue/records returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenue: 10 }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/revenue/records rejects negative revenue", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_id: "conn-1",
          platform: "etsy",
          revenue: -5,
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
            { connection_id: "conn-1", platform: "etsy", revenue: 10, order_date: "2026-03-01" },
            { connection_id: "conn-1", platform: "etsy", revenue: 20, order_date: "2026-03-02" },
          ],
        }),
      }),
      env
    );
    expect(res.status).toBe(200);
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
    const csv = "revenue,order_date\n29.99,2026-03-15\n14.50,2026-03-16";
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

  it("POST /api/revenue/import/csv returns 400 for missing csv", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/revenue/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_id: "conn-1", platform: "etsy" }),
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

describe("nexus-router: ROI Routes (Phase 2)", () => {
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
        body: JSON.stringify({ domain_id: "dom-1", amount: 15.5 }),
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

  it("POST /api/roi/costs rejects negative amount", async () => {
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

  it("DELETE /api/roi/costs/:id deletes a cost", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/roi/costs/cost-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.data).toHaveProperty("deleted", "cost-1");
  });

  it("POST /api/roi/snapshots generates a snapshot", async () => {
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
  });

  it("POST /api/roi/snapshots returns 400 for missing dates", async () => {
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

  it("POST /api/roi/reports generates a report", async () => {
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
  });

  it("GET /api/roi/reports returns report list", async () => {
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

describe("nexus-router: Recycler Routes (Phase 3)", () => {
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

  it("GET /api/recycler/analyze/:productId returns 500 when product not found", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/analyze/prod-1"),
      env
    );
    // analyzeProduct throws "Product not found" when DB has no matching product
    expect(res.status).toBe(500);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(false);
  });

  it("GET /api/recycler/jobs returns jobs list", async () => {
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
          strategy: "remix",
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
        body: JSON.stringify({ strategy: "remix" }),
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
    expect(data.data).toHaveProperty("deleted", "job-1");
  });

  it("POST /api/recycler/jobs/:id/generate returns 500 when job not found", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/recycler/jobs/job-1/generate", { method: "POST" }),
      env
    );
    // generateVariations throws "Recycler job not found" when DB has no matching job
    expect(res.status).toBe(500);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(false);
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

describe("nexus-router: Localization Routes (Phase 3)", () => {
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

  it("GET /api/localization/jobs returns jobs list", async () => {
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
          languages: ["es", "fr", "de"],
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/localization/jobs returns 400 for missing languages", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_product_id: "prod-1", languages: [] }),
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
    expect(data.data).toHaveProperty("deleted", "loc-1");
  });

  it("POST /api/localization/jobs/:id/execute returns 500 when job not found", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/localization/jobs/loc-1/execute", { method: "POST" }),
      env
    );
    // executeLocalization throws "Localization job not found" when DB has no matching job
    expect(res.status).toBe(500);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(false);
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

describe("nexus-router: Chatbot Routes (Phase 3)", () => {
  it("POST /api/chatbot/chat sends a message", async () => {
    const aiFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: {
          content: "I can help you create a product!",
          actions: [],
        },
      });
    });

    const env = buildEnv({ NEXUS_AI: aiFetcher });
    const res = await app.fetch(
      makeRequest("/api/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Create a new candle template" }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("conversation_id");
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

  it("POST /api/chatbot/chat returns 400 for message exceeding max length", async () => {
    const env = buildEnv();
    const longMessage = "x".repeat(5000);
    const res = await app.fetch(
      makeRequest("/api/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: longMessage }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("POST /api/chatbot/execute returns 400 for missing fields", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/chatbot/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: "conv-1" }),
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

  it("GET /api/chatbot/history/:id returns conversation messages", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/chatbot/history/conv-1"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("DELETE /api/chatbot/history/:id deletes conversation", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/chatbot/history/conv-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.data).toHaveProperty("deleted", "conv-1");
  });
});

// ============================================================
// PROJECT BUILDER ROUTES
// ============================================================

describe("nexus-router: Project Builder Routes (Phase 3)", () => {
  it("POST /api/project-builder starts a build", async () => {
    const aiFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: { build_id: "build-1", status: "running" },
      });
    });

    const env = buildEnv({ NEXUS_AI: aiFetcher });
    const res = await app.fetch(
      makeRequest("/api/project-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: "A Notion template for freelancers to track invoices",
          tech_stack: "notion",
        }),
      }),
      env
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("POST /api/project-builder returns 400 for missing idea", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tech_stack: "notion" }),
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
  });

  it("GET /api/project-builder/:buildId returns build progress", async () => {
    const storageFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: { build_id: "build-1", status: "completed", progress: 100 },
      });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/project-builder/build-1"),
      env
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/project-builder/:buildId/details returns details", async () => {
    const storageFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: { build_id: "build-1", idea: "Invoice tracker" },
      });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/project-builder/build-1/details"),
      env
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/project-builder/:buildId/files returns generated files", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder/build-1/files"),
      env
    );
    expect(res.status).toBe(200);
  });

  it("POST /api/project-builder/:buildId/rebuild requires feedback", async () => {
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

  it("POST /api/project-builder/:buildId/cancel cancels build", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder/build-1/cancel", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/project-builder/:buildId deletes build", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/project-builder/build-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
  });
});

// ============================================================
// BRIEFINGS ROUTES
// ============================================================

describe("nexus-router: Briefing Routes (Phase 3)", () => {
  it("GET /api/briefings returns briefing list", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/api/briefings"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("GET /api/briefings/settings returns default settings", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/briefings/settings"),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
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
          focus_keywords: ["candles", "templates"],
        }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
  });

  it("PUT /api/briefings/settings rejects invalid briefing_hour", async () => {
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

  it("PUT /api/briefings/settings returns 400 for empty body", async () => {
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

  it("GET /api/briefings/:id returns a specific briefing", async () => {
    const storageFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: [
          {
            id: "brief-1",
            title: "Morning Briefing",
            sections: "[]",
            domains_analyzed: "[]",
            focus_keywords: "[]",
          },
        ],
      });
    });

    const env = buildEnv({ NEXUS_STORAGE: storageFetcher });
    const res = await app.fetch(
      makeRequest("/api/briefings/brief-1"),
      env
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/briefings/:id deletes a briefing", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/api/briefings/brief-1", { method: "DELETE" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.data).toHaveProperty("deleted", "brief-1");
  });

  it("POST /api/briefings/generate triggers briefing generation", async () => {
    const aiFetcher = createMockFetcher(async () => {
      return jsonResponse({
        success: true,
        data: {
          title: "Daily Briefing",
          summary: "Market trends indicate...",
          sections: [{ type: "trends", content: "Candle demand up 15%" }],
          domains_analyzed: ["digital-products"],
          ai_model_used: "test-model",
          tokens_used: 500,
        },
      });
    });

    const env = buildEnv({ NEXUS_AI: aiFetcher });
    const res = await app.fetch(
      makeRequest("/api/briefings/generate", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as TestApiResponse;
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("title");
  });
});
