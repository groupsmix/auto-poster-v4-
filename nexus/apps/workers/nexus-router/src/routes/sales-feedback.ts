// ============================================================
// Sales Feedback Loop Routes
// GET /api/sales-feedback/status
// POST /api/sales-feedback/run
// GET /api/sales-feedback/learning-data
// GET /api/sales-feedback/niche-adjustments
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  runSalesFeedbackLoop,
  getSalesLearningData,
  getNicheAdjustments,
} from "../services/sales-feedback-service";

const salesFeedback = new Hono<{ Bindings: RouterEnv }>();

// POST /api/sales-feedback/run — run the full feedback loop
salesFeedback.post("/run", async (c) => {
  try {
    const result = await runSalesFeedbackLoop(c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/sales-feedback/learning-data — get current AI learning data
salesFeedback.get("/learning-data", async (c) => {
  try {
    const data = await getSalesLearningData(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/sales-feedback/niche-adjustments — get niche adjustment recommendations
salesFeedback.get("/niche-adjustments", async (c) => {
  try {
    const data = await getNicheAdjustments(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default salesFeedback;
