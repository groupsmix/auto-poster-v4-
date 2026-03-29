import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, storageCleanup, errorResponse } from "../helpers";

const assets = new Hono<{ Bindings: RouterEnv }>();

// GET /api/assets — list all assets
assets.get("/", async (c) => {
  try {
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "50", 10);
    const offset = (page - 1) * pageSize;

    const countResult = (await storageQuery(
      c.env,
      "SELECT COUNT(*) as total FROM assets"
    )) as Array<{ total: number }>;

    const total = countResult?.[0]?.total ?? 0;

    const data = await storageQuery(
      c.env,
      `SELECT a.*, p.name as product_name
       FROM assets a
       LEFT JOIN products p ON p.id = a.product_id
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return c.json({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/assets/:productId — list assets for product
assets.get("/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");
    const data = await storageQuery(
      c.env,
      "SELECT * FROM assets WHERE product_id = ? ORDER BY created_at DESC",
      [productId]
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/assets/:id — delete asset (synced cleanup)
assets.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await storageCleanup(c.env, "asset", id);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default assets;
