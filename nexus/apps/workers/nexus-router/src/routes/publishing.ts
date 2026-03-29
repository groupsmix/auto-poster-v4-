import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const publishing = new Hono<{ Bindings: RouterEnv }>();

// GET /api/publish/ready — list approved products ready to publish
publishing.get("/ready", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT p.*,
              (SELECT COUNT(*) FROM platform_variants pv WHERE pv.product_id = p.id) as variant_count,
              (SELECT COUNT(*) FROM social_variants sv WHERE sv.product_id = p.id) as social_count
       FROM products p
       WHERE p.status = 'approved'
       ORDER BY p.updated_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/publish/:productId — publish to selected platforms
publishing.post("/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");
    const body = await c.req.json<{
      platform_ids?: string[];
      channel_ids?: string[];
    }>();

    const ts = now();

    // Update product status to published
    await storageQuery(
      c.env,
      "UPDATE products SET status = 'published', updated_at = ? WHERE id = ?",
      [ts, productId]
    );

    // Update selected platform variants to published
    if (body.platform_ids && body.platform_ids.length > 0) {
      const placeholders = body.platform_ids.map(() => "?").join(", ");
      await storageQuery(
        c.env,
        `UPDATE platform_variants SET status = 'published', published_at = ?
         WHERE product_id = ? AND platform_id IN (${placeholders})`,
        [ts, productId, ...body.platform_ids]
      );
    }

    // Update selected social variants to published
    if (body.channel_ids && body.channel_ids.length > 0) {
      const placeholders = body.channel_ids.map(() => "?").join(", ");
      await storageQuery(
        c.env,
        `UPDATE social_variants SET status = 'published', published_at = ?
         WHERE product_id = ? AND channel_id IN (${placeholders})`,
        [ts, productId, ...body.channel_ids]
      );
    }

    // Update workflow run status
    await storageQuery(
      c.env,
      `UPDATE workflow_runs SET status = 'published'
       WHERE product_id = ? AND status = 'approved'`,
      [productId]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { product_id: productId, status: "published" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/publish/:productId/export — export listings for manual copy
publishing.get("/:productId/export", async (c) => {
  try {
    const productId = c.req.param("productId");

    const [product, platformVariants, socialVariants, assets] =
      await Promise.all([
        storageQuery(c.env, "SELECT * FROM products WHERE id = ?", [
          productId,
        ]),
        storageQuery(
          c.env,
          `SELECT pv.*, pl.name as platform_name, pl.slug as platform_slug
           FROM platform_variants pv
           JOIN platforms pl ON pl.id = pv.platform_id
           WHERE pv.product_id = ?`,
          [productId]
        ),
        storageQuery(
          c.env,
          `SELECT sv.*, sc.name as channel_name, sc.slug as channel_slug
           FROM social_variants sv
           JOIN social_channels sc ON sc.id = sv.channel_id
           WHERE sv.product_id = ?`,
          [productId]
        ),
        storageQuery(c.env, "SELECT * FROM assets WHERE product_id = ?", [
          productId,
        ]),
      ]);

    return c.json<ApiResponse>({
      success: true,
      data: {
        product,
        platform_listings: platformVariants,
        social_content: socialVariants,
        assets,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default publishing;
