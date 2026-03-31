// ============================================================
// Scheduler Routes — CRUD + cron tick for automatic product creation
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse, sanitizeInput } from "../helpers";
import {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  getScheduleRuns,
  executeDueSchedules,
} from "../services/scheduler-service";

const schedules = new Hono<{ Bindings: RouterEnv }>();

// GET /api/schedules — list all schedules
schedules.get("/", async (c) => {
  try {
    const data = await listSchedules(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/schedules/:id — get schedule by ID
schedules.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getSchedule(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/schedules — create new schedule
schedules.post("/", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      domain_id: string;
      category_id?: string;
      niche_keywords?: string[];
      products_per_run?: number;
      interval_hours?: number;
      platforms?: string[];
      social_channels?: string[];
      language?: string;
      auto_approve_threshold?: number;
      auto_revise_min_score?: number;
      max_auto_revisions?: number;
    }>();

    if (!body.name || !body.domain_id) {
      return c.json<ApiResponse>(
        { success: false, error: "name and domain_id are required" },
        400
      );
    }

    body.name = sanitizeInput(body.name);

    if (body.interval_hours !== undefined && (body.interval_hours < 1 || !Number.isFinite(body.interval_hours))) {
      return c.json<ApiResponse>(
        { success: false, error: "interval_hours must be a positive number (>= 1)" },
        400
      );
    }

    if (body.products_per_run !== undefined && (body.products_per_run < 1 || !Number.isInteger(body.products_per_run))) {
      return c.json<ApiResponse>(
        { success: false, error: "products_per_run must be a positive integer" },
        400
      );
    }

    if (body.auto_approve_threshold !== undefined && (body.auto_approve_threshold < 0 || body.auto_approve_threshold > 100)) {
      return c.json<ApiResponse>(
        { success: false, error: "auto_approve_threshold must be between 0 and 100" },
        400
      );
    }

    const result = await createSchedule(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/schedules/:id — update schedule
schedules.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<Record<string, unknown>>();
    const result = await updateSchedule(id, body, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/schedules/:id — delete schedule
schedules.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await deleteSchedule(id, c.env);
    return c.json<ApiResponse>({ success: true, data: { deleted: id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/schedules/:id/toggle — toggle schedule active/inactive
schedules.post("/:id/toggle", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{ active: boolean }>();
    await toggleSchedule(id, body.active, c.env);
    return c.json<ApiResponse>({ success: true, data: { id, active: body.active } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/schedules/:id/runs — get schedule run history
schedules.get("/:id/runs", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getScheduleRuns(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/schedules/tick — execute all due schedules (called by cron)
schedules.post("/tick", async (c) => {
  try {
    const result = await executeDueSchedules(c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default schedules;
