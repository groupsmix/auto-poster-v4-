import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { PRODUCT_STATUS } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse, sanitizeInput } from "../helpers";
import { approveProduct, rejectProduct } from "../services/review-service";

const reviews = new Hono<{ Bindings: RouterEnv }>();

// GET /api/reviews/pending — list pending reviews
reviews.get("/pending", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT p.*, wr.id as run_id, wr.status as run_status,
              wr.started_at as run_started_at, wr.completed_at as run_finished_at,
              wr.total_tokens, wr.total_cost, wr.cache_hits
       FROM products p
       LEFT JOIN workflow_runs wr ON wr.product_id = p.id
       WHERE p.status = '${PRODUCT_STATUS.PENDING_REVIEW}'
       ORDER BY p.updated_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/reviews/in-revision — list products in revision
reviews.get("/in-revision", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT p.*, wr.id as run_id, wr.status as run_status,
              wr.started_at as run_started_at, wr.completed_at as run_finished_at,
              wr.total_tokens, wr.total_cost, wr.cache_hits
       FROM products p
       LEFT JOIN workflow_runs wr ON wr.product_id = p.id
       WHERE p.status = '${PRODUCT_STATUS.IN_REVISION}'
       ORDER BY p.updated_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/reviews/history — list reviewed products (approved/rejected/published)
reviews.get("/history", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT p.*, wr.id as run_id, wr.status as run_status,
              wr.started_at as run_started_at, wr.completed_at as run_finished_at,
              wr.total_tokens, wr.total_cost, wr.cache_hits
       FROM products p
       LEFT JOIN workflow_runs wr ON wr.product_id = p.id
       WHERE p.status IN ('${PRODUCT_STATUS.APPROVED}', '${PRODUCT_STATUS.REJECTED}', '${PRODUCT_STATUS.PUBLISHED}')
       ORDER BY p.updated_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/reviews/:productId — get review for product
reviews.get("/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");

    const data = await storageQuery(
      c.env,
      `SELECT r.*, p.name as product_name, p.status as product_status
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE r.product_id = ?
       ORDER BY r.version DESC`,
      [productId]
    );

    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/reviews/:productId/approve — approve product
reviews.post("/:productId/approve", async (c) => {
  try {
    const productId = c.req.param("productId");
    const result = await approveProduct(productId, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/reviews/:productId/reject — reject with feedback
reviews.post("/:productId/reject", async (c) => {
  try {
    const productId = c.req.param("productId");
    const body = await c.req.json<{ feedback?: string }>();

    if (!body.feedback) {
      return c.json<ApiResponse>(
        { success: false, error: "feedback is required for rejection" },
        400
      );
    }

    body.feedback = sanitizeInput(body.feedback);
    const result = await rejectProduct(productId, body.feedback, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default reviews;
