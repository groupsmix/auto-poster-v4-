import { Hono } from "hono";
import type { ApiResponse, Bundle, BundleItem } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const bundles = new Hono<{ Bindings: RouterEnv }>();

// GET /api/bundles — list all bundles with item counts
bundles.get("/", async (c) => {
  try {
    const bundleList = await storageQuery<Bundle[]>(
      c.env,
      `SELECT b.*,
        d.name as domain_name,
        c.name as category_name,
        (SELECT COUNT(*) FROM bundle_items bi WHERE bi.bundle_id = b.id) as item_count
      FROM bundles b
      LEFT JOIN domains d ON d.id = b.domain_id
      LEFT JOIN categories c ON c.id = b.category_id
      ORDER BY b.created_at DESC`
    );

    return c.json<ApiResponse>({ success: true, data: bundleList });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/bundles/:id — get single bundle with items
bundles.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const bundleRows = await storageQuery<Bundle[]>(
      c.env,
      `SELECT b.*,
        d.name as domain_name,
        c.name as category_name
      FROM bundles b
      LEFT JOIN domains d ON d.id = b.domain_id
      LEFT JOIN categories c ON c.id = b.category_id
      WHERE b.id = ?`,
      [id]
    );

    if (!bundleRows.length) {
      return c.json<ApiResponse>({ success: false, error: "Bundle not found" }, 404);
    }

    const items = await storageQuery<BundleItem[]>(
      c.env,
      `SELECT bi.*, p.niche as product_name, p.niche as product_niche
       FROM bundle_items bi
       LEFT JOIN products p ON p.id = bi.product_id
       WHERE bi.bundle_id = ?
       ORDER BY bi.sort_order ASC`,
      [id]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { ...bundleRows[0], items, item_count: items.length },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/bundles — create a new bundle
bundles.post("/", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      domain_id?: string;
      category_id?: string;
      bundle_price?: number;
      product_ids?: string[];
    }>();

    if (!body.name) {
      return c.json<ApiResponse>({ success: false, error: "name is required" }, 400);
    }

    const id = crypto.randomUUID();
    await storageQuery(
      c.env,
      `INSERT INTO bundles (id, name, description, domain_id, category_id, bundle_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, body.name, body.description ?? null, body.domain_id ?? null, body.category_id ?? null, body.bundle_price ?? null]
    );

    // Add items if provided
    if (body.product_ids?.length) {
      for (let i = 0; i < body.product_ids.length; i++) {
        const itemId = crypto.randomUUID();
        await storageQuery(
          c.env,
          `INSERT INTO bundle_items (id, bundle_id, product_id, sort_order) VALUES (?, ?, ?, ?)`,
          [itemId, id, body.product_ids[i], i]
        );
      }

      // Calculate totals
      await recalculateBundle(c.env, id);
    }

    return c.json<ApiResponse>({ success: true, data: { id } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/bundles/:id — update bundle info
bundles.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<Partial<Bundle>>();

    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); params.push(body.name); }
    if (body.description !== undefined) { fields.push("description = ?"); params.push(body.description); }
    if (body.domain_id !== undefined) { fields.push("domain_id = ?"); params.push(body.domain_id); }
    if (body.category_id !== undefined) { fields.push("category_id = ?"); params.push(body.category_id); }
    if (body.bundle_price !== undefined) { fields.push("bundle_price = ?"); params.push(body.bundle_price); }
    if (body.status !== undefined) { fields.push("status = ?"); params.push(body.status); }

    if (fields.length === 0) {
      return c.json<ApiResponse>({ success: false, error: "No fields to update" }, 400);
    }

    fields.push("updated_at = datetime('now')");
    params.push(id);

    await storageQuery(
      c.env,
      `UPDATE bundles SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/bundles/:id/items — add product to bundle
bundles.post("/:id/items", async (c) => {
  try {
    const bundleId = c.req.param("id");
    const body = await c.req.json<{ product_id: string }>();

    if (!body.product_id) {
      return c.json<ApiResponse>({ success: false, error: "product_id is required" }, 400);
    }

    // Get current max sort order
    const maxOrder = await storageQuery<Array<{ max_order: number }>>(
      c.env,
      `SELECT COALESCE(MAX(sort_order), -1) as max_order FROM bundle_items WHERE bundle_id = ?`,
      [bundleId]
    );

    const itemId = crypto.randomUUID();
    await storageQuery(
      c.env,
      `INSERT INTO bundle_items (id, bundle_id, product_id, sort_order) VALUES (?, ?, ?, ?)`,
      [itemId, bundleId, body.product_id, (maxOrder[0]?.max_order ?? -1) + 1]
    );

    await recalculateBundle(c.env, bundleId);

    return c.json<ApiResponse>({ success: true, data: { id: itemId } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/bundles/:id/items/:itemId — remove product from bundle
bundles.delete("/:id/items/:itemId", async (c) => {
  try {
    const bundleId = c.req.param("id");
    const itemId = c.req.param("itemId");
    await storageQuery(c.env, `DELETE FROM bundle_items WHERE id = ? AND bundle_id = ?`, [itemId, bundleId]);
    await recalculateBundle(c.env, bundleId);
    return c.json<ApiResponse>({ success: true, data: { id: itemId } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/bundles/:id — delete bundle
bundles.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, `DELETE FROM bundle_items WHERE bundle_id = ?`, [id]);
    await storageQuery(c.env, `DELETE FROM bundles WHERE id = ?`, [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/bundles/auto-group — automatically group related products into bundles
bundles.post("/auto-group", async (c) => {
  try {
    const body = await c.req.json<{
      domain_id?: string;
      category_id?: string;
      min_items?: number;
      price_multiplier?: number;
    }>();

    // Find products that can be grouped by niche/category
    let sql = `SELECT id, niche, category_id FROM products WHERE status = 'published'`;
    const params: unknown[] = [];

    if (body.domain_id) {
      sql += ` AND domain_id = ?`;
      params.push(body.domain_id);
    }
    if (body.category_id) {
      sql += ` AND category_id = ?`;
      params.push(body.category_id);
    }

    const products = await storageQuery<Array<{ id: string; niche: string; category_id: string }>>(
      c.env, sql, params
    );

    // Group by niche
    const groups = new Map<string, string[]>();
    for (const p of products) {
      const key = p.niche || "uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p.id);
    }

    const minItems = body.min_items ?? 3;
    const multiplier = body.price_multiplier ?? 2.5;
    let bundlesCreated = 0;

    for (const [niche, productIds] of groups) {
      if (productIds.length < minItems) continue;

      const bundleId = crypto.randomUUID();
      const bundleName = `Complete ${niche.charAt(0).toUpperCase() + niche.slice(1)} Pack`;

      await storageQuery(
        c.env,
        `INSERT INTO bundles (id, name, description, domain_id, category_id, status)
         VALUES (?, ?, ?, ?, ?, 'draft')`,
        [bundleId, bundleName, `Auto-generated bundle of ${productIds.length} ${niche} products`, body.domain_id ?? null, body.category_id ?? null]
      );

      for (let i = 0; i < productIds.length; i++) {
        const itemId = crypto.randomUUID();
        await storageQuery(
          c.env,
          `INSERT INTO bundle_items (id, bundle_id, product_id, sort_order) VALUES (?, ?, ?, ?)`,
          [itemId, bundleId, productIds[i], i]
        );
      }

      await recalculateBundle(c.env, bundleId, multiplier);
      bundlesCreated++;
    }

    return c.json<ApiResponse>({ success: true, data: { bundles_created: bundlesCreated } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

async function recalculateBundle(env: RouterEnv, bundleId: string, multiplier?: number): Promise<void> {
  // For now set individual_total based on item count and a base price estimate
  const itemCount = await storageQuery<Array<{ count: number }>>(
    env,
    `SELECT COUNT(*) as count FROM bundle_items WHERE bundle_id = ?`,
    [bundleId]
  );

  const count = itemCount[0]?.count ?? 0;
  const basePrice = count * 5; // $5 per item estimate
  const bundlePrice = Math.round(basePrice * (multiplier ?? 2.5) * 100) / 100;

  await storageQuery(
    env,
    `UPDATE bundles SET
      individual_total = ?,
      bundle_price = CASE WHEN bundle_price IS NULL THEN ? ELSE bundle_price END,
      savings_pct = CASE WHEN bundle_price IS NOT NULL AND ? > 0
        THEN ROUND((1 - bundle_price / ?) * 100, 1)
        ELSE 0 END,
      updated_at = datetime('now')
    WHERE id = ?`,
    [basePrice, bundlePrice, basePrice, basePrice, bundleId]
  );
}

export default bundles;
