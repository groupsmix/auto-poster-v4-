// ============================================================
// Niche Auto-Discovery / Daily Scout Routes
// GET /api/niche-discovery/dashboard
// POST /api/niche-discovery/run-scout
// GET /api/niche-discovery/discoveries
// PUT /api/niche-discovery/discoveries/:id
// DELETE /api/niche-discovery/discoveries/:id
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";
import {
  runDailyScout,
  getDailyScoutDashboard,
} from "../services/niche-discovery-service";

const nicheDiscovery = new Hono<{ Bindings: RouterEnv }>();

// GET /api/niche-discovery/dashboard — get Daily Scout dashboard
nicheDiscovery.get("/dashboard", async (c) => {
  try {
    const data = await getDailyScoutDashboard(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/niche-discovery/run-scout — trigger a manual scout run
nicheDiscovery.post("/run-scout", async (c) => {
  try {
    const body = await c.req.json<{ categories?: string[] }>().catch(() => ({}));
    const categories = (body as { categories?: string[] }).categories;
    const result = await runDailyScout(c.env, categories);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/niche-discovery/discoveries — list discoveries with filters
nicheDiscovery.get("/discoveries", async (c) => {
  try {
    const status = c.req.query("status");
    const limit = parseInt(c.req.query("limit") ?? "50");

    let sql = `SELECT * FROM niche_discoveries`;
    const params: unknown[] = [];

    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY discovered_at DESC LIMIT ?`;
    params.push(limit);

    const discoveries = await storageQuery(c.env, sql, params);
    return c.json<ApiResponse>({ success: true, data: discoveries });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/niche-discovery/discoveries/:id — update discovery status
nicheDiscovery.put("/discoveries/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{ status: string }>();

    if (!["new", "reviewed", "accepted", "rejected"].includes(body.status)) {
      return c.json<ApiResponse>({ success: false, error: "Invalid status" }, 400);
    }

    await storageQuery(
      c.env,
      `UPDATE niche_discoveries SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      [body.status, id]
    );

    return c.json<ApiResponse>({ success: true, data: { id, status: body.status } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/niche-discovery/discoveries/:id — delete a discovery
nicheDiscovery.delete("/discoveries/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, `DELETE FROM niche_discoveries WHERE id = ?`, [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default nicheDiscovery;
