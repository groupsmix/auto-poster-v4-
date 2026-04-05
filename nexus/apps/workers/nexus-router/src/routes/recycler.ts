// ============================================================
// Smart Product Recycler Routes
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  createRecyclerJob,
  getRecyclerJob,
  listRecyclerJobs,
  deleteRecyclerJob,
  analyzeProduct,
  generateVariations,
  listVariations,
  getTopSellers,
  autoRecycleTopSellers,
} from "../services/recycler-service";

const recycler = new Hono<{ Bindings: RouterEnv }>();

// ============================================================
// Top Sellers (candidates for recycling)
// ============================================================

// GET /api/recycler/top-sellers — get top-selling products
recycler.get("/top-sellers", async (c) => {
  try {
    const limit = c.req.query("limit");
    const data = await getTopSellers(c.env, limit ? parseInt(limit, 10) : undefined);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Product Analysis
// ============================================================

// GET /api/recycler/analyze/:productId — analyze why a product sells
recycler.get("/analyze/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");
    const data = await analyzeProduct(productId, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Recycler Jobs CRUD
// ============================================================

// GET /api/recycler/jobs — list recycler jobs
recycler.get("/jobs", async (c) => {
  try {
    const status = c.req.query("status");
    const limit = c.req.query("limit");

    const data = await listRecyclerJobs(c.env, {
      status: status ?? undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/recycler/jobs/:id — get a recycler job
recycler.get("/jobs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getRecyclerJob(id, c.env);
    if (!data) {
      return errorResponse(c, new Error("Job not found"), 404);
    }
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/recycler/jobs — create a recycler job
recycler.post("/jobs", async (c) => {
  try {
    const body = await c.req.json<{
      source_product_id: string;
      strategy?: string;
      variations_requested?: number;
      config?: Record<string, unknown>;
    }>();

    if (!body.source_product_id) {
      return errorResponse(c, new Error("source_product_id is required"), 400);
    }

    const result = await createRecyclerJob(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/recycler/jobs/:id — delete a recycler job
recycler.delete("/jobs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await deleteRecyclerJob(id, c.env);
    return c.json<ApiResponse>({ success: true, data: { deleted: id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Generate Variations
// ============================================================

// POST /api/recycler/jobs/:id/generate — generate variations for a job
recycler.post("/jobs/:id/generate", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await generateVariations(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/recycler/jobs/:id/variations — list variations for a job
recycler.get("/jobs/:id/variations", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await listVariations(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Auto-Recycle Top Sellers
// ============================================================

// POST /api/recycler/auto-recycle — automatically recycle top-selling products
// Finds best sellers, creates recycler jobs, generates 3-5 variations each,
// and triggers full workflow runs for every variation.
recycler.post("/auto-recycle", async (c) => {
  try {
    const body = await c.req.json<{
      max_products?: number;
      variations_per_product?: number;
      strategy?: string;
      min_revenue?: number;
      min_orders?: number;
    }>().catch((): {
      max_products?: number;
      variations_per_product?: number;
      strategy?: string;
      min_revenue?: number;
      min_orders?: number;
    } => ({}));

    const data = await autoRecycleTopSellers(c.env, {
      max_products: body.max_products,
      variations_per_product: body.variations_per_product,
      strategy: body.strategy,
      min_revenue: body.min_revenue,
      min_orders: body.min_orders,
    });
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default recycler;
