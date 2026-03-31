// ============================================================
// Revenue Routes — platform connections, revenue sync, dashboard
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  listConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  addRevenueRecord,
  addRevenueRecords,
  matchRevenueToProducts,
  updateSyncStatus,
  getRevenueDashboard,
  getRevenueByProduct,
} from "../services/revenue-service";

const revenue = new Hono<{ Bindings: RouterEnv }>();

// ============================================================
// Platform Connections
// ============================================================

// GET /api/revenue/connections — list all platform connections
revenue.get("/connections", async (c) => {
  try {
    const data = await listConnections(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/revenue/connections/:id — get connection by ID
revenue.get("/connections/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getConnection(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/revenue/connections — create new connection
revenue.post("/connections", async (c) => {
  try {
    const body = await c.req.json<{
      platform: string;
      store_name?: string;
      auth_type?: string;
      api_key?: string;
      api_secret?: string;
      access_token?: string;
      refresh_token?: string;
      token_expires_at?: string;
      shop_domain?: string;
      metadata?: Record<string, unknown>;
    }>();

    if (!body.platform) {
      return c.json<ApiResponse>(
        { success: false, error: "platform is required" },
        400
      );
    }

    const result = await createConnection(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/revenue/connections/:id — update connection
revenue.put("/connections/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<Record<string, unknown>>();
    const result = await updateConnection(id, body, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/revenue/connections/:id — delete connection
revenue.delete("/connections/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await deleteConnection(id, c.env);
    return c.json<ApiResponse>({ success: true, data: { deleted: id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Revenue Records
// ============================================================

// POST /api/revenue/records — add single revenue record
revenue.post("/records", async (c) => {
  try {
    const body = await c.req.json<{
      connection_id: string;
      platform: string;
      product_id?: string;
      external_order_id?: string;
      external_product_id?: string;
      external_product_title?: string;
      sku?: string;
      quantity?: number;
      revenue: number;
      currency?: string;
      fees?: number;
      net_revenue?: number;
      order_date: string;
      metadata?: Record<string, unknown>;
    }>();

    if (!body.connection_id || !body.platform || body.revenue === undefined || !body.order_date) {
      return c.json<ApiResponse>(
        { success: false, error: "connection_id, platform, revenue, and order_date are required" },
        400
      );
    }

    const result = await addRevenueRecord(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/revenue/records/bulk — add multiple revenue records (nightly sync)
revenue.post("/records/bulk", async (c) => {
  try {
    const body = await c.req.json<{
      records: Array<{
        connection_id: string;
        platform: string;
        product_id?: string;
        external_order_id?: string;
        external_product_id?: string;
        external_product_title?: string;
        sku?: string;
        quantity?: number;
        revenue: number;
        currency?: string;
        fees?: number;
        net_revenue?: number;
        order_date: string;
        metadata?: Record<string, unknown>;
      }>;
    }>();

    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "records array is required and must not be empty" },
        400
      );
    }

    const result = await addRevenueRecords(body.records, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Sync & Matching
// ============================================================

// POST /api/revenue/connections/:id/sync — trigger sync for connection
revenue.post("/connections/:id/sync", async (c) => {
  try {
    const id = c.req.param("id");

    // Mark as syncing
    await updateSyncStatus(id, "syncing", c.env);

    // Match revenue records to products
    const matchResult = await matchRevenueToProducts(id, c.env);

    // Mark as idle
    await updateSyncStatus(id, "idle", c.env);

    return c.json<ApiResponse>({
      success: true,
      data: {
        connection_id: id,
        matched_products: matchResult.matched,
        status: "completed",
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// Dashboard
// ============================================================

// GET /api/revenue/dashboard — get revenue dashboard data
revenue.get("/dashboard", async (c) => {
  try {
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    const platform = c.req.query("platform");
    const domainId = c.req.query("domain_id");

    const data = await getRevenueDashboard(c.env, {
      start_date: startDate,
      end_date: endDate,
      platform,
      domain_id: domainId,
    });

    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/revenue/products/:productId — get revenue for a specific product
revenue.get("/products/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");
    const data = await getRevenueByProduct(productId, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default revenue;
