import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { now, PRODUCT_STATUS, WorkflowRunStatus } from "@nexus/shared";
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
       WHERE p.status = '${PRODUCT_STATUS.APPROVED}'
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
      `UPDATE products SET status = '${PRODUCT_STATUS.PUBLISHED}', updated_at = ? WHERE id = ?`,
      [ts, productId]
    );

    // Update selected platform variants to published
    if (body.platform_ids && body.platform_ids.length > 0) {
      const placeholders = body.platform_ids.map(() => "?").join(", ");
      await storageQuery(
        c.env,
        `UPDATE platform_variants SET status = '${PRODUCT_STATUS.PUBLISHED}', published_at = ?
         WHERE product_id = ? AND platform_id IN (${placeholders})`,
        [ts, productId, ...body.platform_ids]
      );
    }

    // Update selected social variants to published
    if (body.channel_ids && body.channel_ids.length > 0) {
      const placeholders = body.channel_ids.map(() => "?").join(", ");
      await storageQuery(
        c.env,
        `UPDATE social_variants SET status = '${PRODUCT_STATUS.PUBLISHED}', published_at = ?
         WHERE product_id = ? AND channel_id IN (${placeholders})`,
        [ts, productId, ...body.channel_ids]
      );
    }

    // Update workflow run status
    await storageQuery(
      c.env,
            `UPDATE workflow_runs SET status = '${WorkflowRunStatus.PUBLISHED}'
             WHERE product_id = ? AND status = '${WorkflowRunStatus.APPROVED}'`,
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

// ============================================================
// Platform-Ready Export Formats
// ============================================================

interface VariantRow {
  title?: string;
  description?: string;
  tags?: string;
  price?: number;
  platform_name?: string;
  platform_slug?: string;
}

interface AssetRow {
  url?: string;
  alt_text?: string;
  asset_type?: string;
}

interface ProductRow {
  name?: string;
  niche?: string;
}

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const obj = result as { results?: T[] } | undefined;
  return obj?.results ?? [];
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return raw.split(",").map((t) => t.trim()).filter(Boolean);
  }
}

// GET /api/publish/:productId/export/etsy-csv — Etsy-ready CSV
publishing.get("/:productId/export/etsy-csv", async (c) => {
  try {
    const productId = c.req.param("productId");

    const [variantsRaw, assetsRaw] = await Promise.all([
      storageQuery(
        c.env,
        `SELECT pv.title, pv.description, pv.tags, pv.price,
                pl.name as platform_name, pl.slug as platform_slug
         FROM platform_variants pv
         JOIN platforms pl ON pl.id = pv.platform_id
         WHERE pv.product_id = ?`,
        [productId]
      ),
      storageQuery(c.env, "SELECT url, alt_text, asset_type FROM assets WHERE product_id = ?", [
        productId,
      ]),
    ]);

    const variants = extractRows<VariantRow>(variantsRaw);
    const assets = extractRows<AssetRow>(assetsRaw);
    const imageUrls = assets
      .filter((a) => a.asset_type === "image" || !a.asset_type)
      .map((a) => a.url ?? "");

    // Etsy CSV header
    const headers = [
      "title", "description", "price", "quantity", "tags",
      "image1", "image2", "image3", "image4", "image5",
      "when_made", "who_made", "is_supply", "taxonomy_id",
    ];

    const escapeCSV = (val: string): string => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = variants.map((v) => {
      const tags = parseTags(v.tags as string | undefined);
      return [
        escapeCSV(v.title ?? ""),
        escapeCSV(v.description ?? ""),
        String(v.price ?? "0.00"),
        "999",
        escapeCSV(tags.slice(0, 13).join(",")),
        imageUrls[0] ?? "",
        imageUrls[1] ?? "",
        imageUrls[2] ?? "",
        imageUrls[3] ?? "",
        imageUrls[4] ?? "",
        "2020_2025",
        "i_did",
        "false",
        "",
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="etsy-${productId}.csv"`,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/publish/:productId/export/gumroad-json — Gumroad-ready JSON
publishing.get("/:productId/export/gumroad-json", async (c) => {
  try {
    const productId = c.req.param("productId");

    const [productRaw, variantsRaw, assetsRaw] = await Promise.all([
      storageQuery(c.env, "SELECT name, niche FROM products WHERE id = ?", [productId]),
      storageQuery(
        c.env,
        `SELECT pv.title, pv.description, pv.tags, pv.price
         FROM platform_variants pv
         WHERE pv.product_id = ?`,
        [productId]
      ),
      storageQuery(c.env, "SELECT url, alt_text, asset_type FROM assets WHERE product_id = ?", [
        productId,
      ]),
    ]);

    const products = extractRows<ProductRow>(productRaw);
    const variants = extractRows<VariantRow>(variantsRaw);
    const assets = extractRows<AssetRow>(assetsRaw);
    const product = products[0];
    const variant = variants[0];

    const gumroadPayload = {
      name: variant?.title ?? product?.name ?? "",
      description: variant?.description ?? "",
      price: (variant?.price ?? 0) * 100, // Gumroad uses cents
      tags: parseTags(variant?.tags as string | undefined),
      preview_url: assets.find((a) => a.asset_type === "image" || !a.asset_type)?.url ?? null,
      published: true,
      customizable_price: false,
    };

    return c.json<ApiResponse>({
      success: true,
      data: {
        format: "gumroad",
        product_id: productId,
        payload: gumroadPayload,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/publish/:productId/export/shopify-json — Shopify-ready JSON
publishing.get("/:productId/export/shopify-json", async (c) => {
  try {
    const productId = c.req.param("productId");

    const [productRaw, variantsRaw, assetsRaw] = await Promise.all([
      storageQuery(c.env, "SELECT name, niche FROM products WHERE id = ?", [productId]),
      storageQuery(
        c.env,
        `SELECT pv.title, pv.description, pv.tags, pv.price
         FROM platform_variants pv
         WHERE pv.product_id = ?`,
        [productId]
      ),
      storageQuery(c.env, "SELECT url, alt_text, asset_type FROM assets WHERE product_id = ?", [
        productId,
      ]),
    ]);

    const products = extractRows<ProductRow>(productRaw);
    const variants = extractRows<VariantRow>(variantsRaw);
    const assets = extractRows<AssetRow>(assetsRaw);
    const product = products[0];

    const shopifyPayload = {
      product: {
        title: variants[0]?.title ?? product?.name ?? "",
        body_html: variants[0]?.description ?? "",
        vendor: "",
        product_type: product?.niche ?? "",
        tags: parseTags(variants[0]?.tags as string | undefined).join(", "),
        variants: variants.map((v) => ({
          title: v.title ?? "Default",
          price: String(v.price ?? "0.00"),
          sku: "",
          inventory_quantity: 999,
        })),
        images: assets
          .filter((a) => a.asset_type === "image" || !a.asset_type)
          .map((a) => ({ src: a.url ?? "", alt: a.alt_text ?? "" })),
      },
    };

    return c.json<ApiResponse>({
      success: true,
      data: {
        format: "shopify",
        product_id: productId,
        payload: shopifyPayload,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default publishing;
