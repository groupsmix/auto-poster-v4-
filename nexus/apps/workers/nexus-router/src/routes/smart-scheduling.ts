// ============================================================
// Smart Scheduling Routes
// GET /api/smart-scheduling/optimal-times
// GET /api/smart-scheduling/optimal-times/:platform
// GET /api/smart-scheduling/dynamic-interval/:scheduleId
// POST /api/smart-scheduling/apply-interval/:scheduleId
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  getOptimalPostingTimes,
  getAllOptimalTimes,
  calculateDynamicInterval,
  applyDynamicInterval,
} from "../services/smart-scheduling-service";

const smartScheduling = new Hono<{ Bindings: RouterEnv }>();

// GET /api/smart-scheduling/optimal-times — get optimal times for all platforms
smartScheduling.get("/optimal-times", async (c) => {
  try {
    const timezone = c.req.query("timezone") ?? "UTC";
    const data = getAllOptimalTimes(timezone);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/smart-scheduling/optimal-times/:platform — get optimal times for a specific platform
smartScheduling.get("/optimal-times/:platform", async (c) => {
  try {
    const platform = c.req.param("platform");
    const timezone = c.req.query("timezone") ?? "UTC";
    const data = getOptimalPostingTimes(platform, timezone);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/smart-scheduling/dynamic-interval/:scheduleId — get dynamic interval suggestion
smartScheduling.get("/dynamic-interval/:scheduleId", async (c) => {
  try {
    const scheduleId = c.req.param("scheduleId");
    const data = await calculateDynamicInterval(scheduleId, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/smart-scheduling/apply-interval/:scheduleId — apply a dynamic interval
smartScheduling.post("/apply-interval/:scheduleId", async (c) => {
  try {
    const scheduleId = c.req.param("scheduleId");
    const body = await c.req.json<{ interval_hours: number }>();

    if (!body.interval_hours || body.interval_hours < 1) {
      return c.json<ApiResponse>({ success: false, error: "interval_hours must be >= 1" }, 400);
    }

    await applyDynamicInterval(scheduleId, body.interval_hours, c.env);
    return c.json<ApiResponse>({ success: true, data: { scheduleId, interval_hours: body.interval_hours } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default smartScheduling;
