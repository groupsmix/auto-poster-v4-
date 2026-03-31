// ============================================================
// ROI Optimizer / Niche Killer Routes
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  addNicheCost,
  listNicheCosts,
  deleteNicheCost,
  generateROISnapshot,
  generateROIReport,
  getROIDashboard,
  listROIReports,
} from "../services/roi-service";

const roi = new Hono<{ Bindings: RouterEnv }>();

// ============================================================
// Niche Costs
// ============================================================

// GET /api/roi/costs — list niche costs
roi.get("/costs", async (c) => {
  try {
    const domainId = c.req.query("domain_id");
    const niche = c.req.query("niche");
    const limit = c.req.query("limit");

    const data = await listNicheCosts(c.env, {
      domain_id: domainId,
      niche,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/roi/costs — add a niche cost
roi.post("/costs", async (c) => {
  try {
    const body = await c.req.json<{
      domain_id: string;
      category_id?: string;
      niche?: string;
      cost_type?: string;
      amount: number;
      currency?: string;
      description?: string;
      product_id?: string;
    }>();

    if (!body.domain_id || body.amount === undefined) {
      return c.json<ApiResponse>(
        { success: false, error: "domain_id and amount are required" },
        400
      );
    }

    const result = await addNicheCost(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/roi/costs/:id — delete a niche cost
roi.delete("/costs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await deleteNicheCost(id, c.env);
    return c.json<ApiResponse>({ success: true, data: { deleted: id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// ROI Snapshots & Reports
// ============================================================

// POST /api/roi/snapshots — generate an ROI snapshot
roi.post("/snapshots", async (c) => {
  try {
    const body = await c.req.json<{
      domain_id: string;
      category_id?: string;
      niche?: string;
      period?: string;
      period_start: string;
      period_end: string;
    }>();

    if (!body.domain_id || !body.period_start || !body.period_end) {
      return c.json<ApiResponse>(
        { success: false, error: "domain_id, period_start, and period_end are required" },
        400
      );
    }

    const result = await generateROISnapshot(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/roi/reports — generate an ROI report
roi.post("/reports", async (c) => {
  try {
    const body = await c.req.json<{
      period_start: string;
      period_end: string;
      report_type?: string;
    }>();

    if (!body.period_start || !body.period_end) {
      return c.json<ApiResponse>(
        { success: false, error: "period_start and period_end are required" },
        400
      );
    }

    const result = await generateROIReport(c.env, body.period_start, body.period_end, body.report_type);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/roi/reports — list ROI reports
roi.get("/reports", async (c) => {
  try {
    const limit = c.req.query("limit");
    const data = await listROIReports(c.env, limit ? parseInt(limit, 10) : undefined);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Dashboard
// ============================================================

// GET /api/roi/dashboard — get ROI dashboard data
roi.get("/dashboard", async (c) => {
  try {
    const period = c.req.query("period");
    const domainId = c.req.query("domain_id");

    const data = await getROIDashboard(c.env, { period, domain_id: domainId });
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default roi;
