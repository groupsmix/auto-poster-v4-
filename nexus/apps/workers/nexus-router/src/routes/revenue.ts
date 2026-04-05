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
  addManualRevenueRecord,
  matchRevenueToProducts,
  updateSyncStatus,
  getRevenueDashboard,
  getRevenueByProduct,
} from "../services/revenue-service";
import type { ManualRevenueInput } from "../services/revenue-service";

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

    if (typeof body.revenue !== "number" || body.revenue < 0) {
      return c.json<ApiResponse>(
        { success: false, error: "revenue must be a non-negative number" },
        400
      );
    }

    if (body.fees !== undefined && (typeof body.fees !== "number" || body.fees < 0)) {
      return c.json<ApiResponse>(
        { success: false, error: "fees must be a non-negative number" },
        400
      );
    }

    const result = await addRevenueRecord(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/revenue/records/manual — add revenue record without a platform connection
revenue.post("/records/manual", async (c) => {
  try {
    const body = await c.req.json<ManualRevenueInput>();

    if (body.revenue === undefined || !body.order_date) {
      return errorResponse(c, new Error("revenue and order_date are required"), 400);
    }

    const result = await addManualRevenueRecord(body, c.env);
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
// CSV Import
// ============================================================

// POST /api/revenue/import/csv — import revenue records from CSV text
revenue.post("/import/csv", async (c) => {
  try {
    const body = await c.req.json<{
      connection_id: string;
      platform: string;
      csv: string;
      column_map?: Record<string, string>;
    }>();

    if (!body.connection_id || !body.platform || !body.csv) {
      return c.json<ApiResponse>(
        { success: false, error: "connection_id, platform, and csv are required" },
        400
      );
    }

    // Parse CSV lines
    const lines = body.csv.trim().split("\n");
    if (lines.length < 2) {
      return c.json<ApiResponse>(
        { success: false, error: "CSV must have a header row and at least one data row" },
        400
      );
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const colMap = body.column_map ?? {};
    const resolve = (field: string): number =>
      headers.indexOf(colMap[field] ?? field);

    // Resolve column indices
    const colRevenue = resolve("revenue");
    const colOrderDate = resolve("order_date");
    if (colRevenue === -1 || colOrderDate === -1) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: `CSV must contain 'revenue' and 'order_date' columns (found: ${headers.join(", ")}). Use column_map to remap.`,
        },
        400
      );
    }
    const colOrderId = resolve("external_order_id");
    const colProductId = resolve("external_product_id");
    const colProductTitle = resolve("external_product_title");
    const colSku = resolve("sku");
    const colQuantity = resolve("quantity");
    const colCurrency = resolve("currency");
    const colFees = resolve("fees");
    const colNetRevenue = resolve("net_revenue");

    const records: Array<{
      connection_id: string;
      platform: string;
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
    }> = [];

    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parser (handles quoted fields with commas)
      const cols: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          cols.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      cols.push(current.trim());

      const revenue = parseFloat(cols[colRevenue]);
      const orderDate = cols[colOrderDate];
      if (isNaN(revenue) || !orderDate) {
        errors.push(`Row ${i + 1}: invalid revenue or order_date`);
        continue;
      }

      records.push({
        connection_id: body.connection_id,
        platform: body.platform,
        external_order_id: colOrderId !== -1 ? cols[colOrderId] : undefined,
        external_product_id: colProductId !== -1 ? cols[colProductId] : undefined,
        external_product_title: colProductTitle !== -1 ? cols[colProductTitle] : undefined,
        sku: colSku !== -1 ? cols[colSku] : undefined,
        quantity: colQuantity !== -1 ? parseInt(cols[colQuantity]) || undefined : undefined,
        revenue,
        currency: colCurrency !== -1 ? cols[colCurrency] : undefined,
        fees: colFees !== -1 ? parseFloat(cols[colFees]) || undefined : undefined,
        net_revenue: colNetRevenue !== -1 ? parseFloat(cols[colNetRevenue]) || undefined : undefined,
        order_date: orderDate,
      });
    }

    if (records.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: `No valid records parsed. Errors: ${errors.join("; ")}` },
        400
      );
    }

    const result = await addRevenueRecords(records, c.env);
    return c.json<ApiResponse>({
      success: true,
      data: { ...result, parse_errors: errors },
    });
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
