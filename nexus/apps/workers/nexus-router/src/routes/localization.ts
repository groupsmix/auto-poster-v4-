// ============================================================
// Multi-Language Printer Routes
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  createLocalizationJob,
  getLocalizationJob,
  listLocalizationJobs,
  deleteLocalizationJob,
  executeLocalization,
  listLocalizedProducts,
  getLocalizationCandidates,
  getAvailableLanguages,
} from "../services/localization-service";

const localization = new Hono<{ Bindings: RouterEnv }>();

// ============================================================
// Languages & Candidates
// ============================================================

// GET /api/localization/languages — get available target languages
localization.get("/languages", (c) => {
  const data = getAvailableLanguages();
  return c.json<ApiResponse>({ success: true, data });
});

// GET /api/localization/candidates — get top-selling English products
localization.get("/candidates", async (c) => {
  try {
    const limit = c.req.query("limit");
    const data = await getLocalizationCandidates(c.env, limit ? parseInt(limit, 10) : undefined);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Localization Jobs CRUD
// ============================================================

// GET /api/localization/jobs — list localization jobs
localization.get("/jobs", async (c) => {
  try {
    const status = c.req.query("status");
    const limit = c.req.query("limit");

    const data = await listLocalizationJobs(c.env, {
      status: status ?? undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/localization/jobs/:id — get a localization job
localization.get("/jobs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getLocalizationJob(id, c.env);
    if (!data) {
      return c.json<ApiResponse>({ success: false, error: "Job not found" }, 404);
    }
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/localization/jobs — create a localization job
localization.post("/jobs", async (c) => {
  try {
    const body = await c.req.json<{
      source_product_id: string;
      languages: string[];
      config?: Record<string, unknown>;
    }>();

    if (!body.source_product_id || !body.languages || body.languages.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "source_product_id and languages[] are required" },
        400
      );
    }

    const result = await createLocalizationJob(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/localization/jobs/:id — delete a localization job
localization.delete("/jobs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await deleteLocalizationJob(id, c.env);
    return c.json<ApiResponse>({ success: true, data: { deleted: id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Execute Localization
// ============================================================

// POST /api/localization/jobs/:id/execute — execute localization for a job
localization.post("/jobs/:id/execute", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await executeLocalization(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/localization/jobs/:id/products — list localized products for a job
localization.get("/jobs/:id/products", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await listLocalizedProducts(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default localization;
