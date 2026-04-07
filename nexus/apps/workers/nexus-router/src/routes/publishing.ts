import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { now, PRODUCT_STATUS, WorkflowRunStatus } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const publishing = new Hono<{ Bindings: RouterEnv }>();

// --- Row types for Ready to Post queries ---

interface ProductRow {
  id: string;
  name?: string;
  status?: string;
  ai_score?: number;
  domain_name?: string;
  category_name?: string;
}

interface PlatformVariantRow {
  product_id: string;
  platform?: string;
  title?: string;
  description?: string;
  tags?: string;
  price?: number;
  seo_score?: number;
  title_score?: number;
  tags_score?: number;
}

interface SocialVariantRow {
  product_id: string;
  channel?: string;
  content?: string;
  scheduled_time?: string;
}

interface ImageRow {
  id: string;
  product_id: string;
  asset_type?: string;
  r2_key?: string;
  url?: string;
  metadata?: string;
  created_at?: string;
}

function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of items) {
    const k = String(item[key] ?? "");
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function parseMetadata(raw: string | undefined | null): {
  prompt: string;
  style?: string;
  platform: string;
  model: string;
  width: number;
  height: number;
} {
  if (!raw) return { prompt: "", platform: "unknown", model: "unknown", width: 0, height: 0 };
  try {
    return JSON.parse(raw) as { prompt: string; style?: string; platform: string; model: string; width: number; height: number };
  } catch {
    return { prompt: "", platform: "unknown", model: "unknown", width: 0, height: 0 };
  }
}

// GET /api/publish/ready — list approved products with full variant + image data
// Used by the "Ready to Post" page for copy-paste ready content
publishing.get("/ready", async (c) => {
  try {
    // 1. Fetch approved products
    const products = await storageQuery<ProductRow[]>(
      c.env,
      `SELECT p.id, p.name, p.status,
              COALESCE(r.ai_score, 0) as ai_score,
              d.name as domain_name, cat.name as category_name
       FROM products p
       LEFT JOIN domains d ON d.id = p.domain_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       LEFT JOIN (SELECT product_id, ai_score FROM reviews ORDER BY version DESC LIMIT 1) r ON r.product_id = p.id
       WHERE p.status = '${PRODUCT_STATUS.APPROVED}'
       ORDER BY p.updated_at DESC`
    );

    const rows = Array.isArray(products) ? products : [];
    if (rows.length === 0) {
      return c.json<ApiResponse>({ success: true, data: [] });
    }

    // 2. Fetch platform variants, social variants, and images for all products in parallel
    const productIds = rows.map((p) => p.id);
    const placeholders = productIds.map(() => "?").join(", ");

    const [platformVariants, socialVariants, images] = await Promise.all([
      storageQuery<PlatformVariantRow[]>(
        c.env,
        `SELECT pv.product_id, pl.slug as platform, pv.title, pv.description, pv.tags, pv.price,
                0 as seo_score, 0 as title_score, 0 as tags_score
         FROM platform_variants pv
         JOIN platforms pl ON pl.id = pv.platform_id
         WHERE pv.product_id IN (${placeholders})`,
        productIds
      ),
      storageQuery<SocialVariantRow[]>(
        c.env,
        `SELECT sv.product_id, sc.slug as channel,
                sv.content,
                sv.scheduled_at as scheduled_time
         FROM social_variants sv
         JOIN social_channels sc ON sc.id = sv.channel_id
         WHERE sv.product_id IN (${placeholders})`,
        productIds
      ),
      storageQuery<ImageRow[]>(
        c.env,
        `SELECT id, product_id, asset_type, r2_key, url, metadata, created_at
         FROM assets
         WHERE product_id IN (${placeholders}) AND asset_type = 'image'
         ORDER BY created_at DESC`,
        productIds
      ),
    ]);

    // 3. Group by product_id
    const pvByProduct = groupBy(Array.isArray(platformVariants) ? platformVariants : [], "product_id");
    const svByProduct = groupBy(Array.isArray(socialVariants) ? socialVariants : [], "product_id");
    const imgByProduct = groupBy(Array.isArray(images) ? images : [], "product_id");

    // 4. Assemble ReadyToPostProduct objects
    const result = rows.map((p) => ({
      id: p.id,
      product_id: p.id,
      product_name: p.name ?? "",
      domain_name: p.domain_name ?? undefined,
      category_name: p.category_name ?? undefined,
      ai_score: p.ai_score ?? 0,
      status: p.status,
      platform_variants: (pvByProduct[p.id] ?? []).map((pv) => ({
        platform: pv.platform ?? "",
        title: pv.title ?? "",
        description: pv.description ?? "",
        tags: parseTags(pv.tags as string | undefined),
        price: pv.price ?? 0,
        scores: { seo: pv.seo_score ?? 0, title: pv.title_score ?? 0, tags: pv.tags_score ?? 0 },
      })),
      social_variants: (svByProduct[p.id] ?? []).map((sv) => {
        let caption = "";
        let hashtags: string[] = [];
        let post_type = "";
        try {
          const parsed = sv.content ? JSON.parse(sv.content) : {};
          caption = parsed.caption ?? parsed.content ?? "";
          hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags
            : typeof parsed.hashtags === "string" ? parseTags(parsed.hashtags) : [];
          post_type = parsed.post_type ?? "";
        } catch {
          caption = sv.content ?? "";
        }
        return {
          channel: sv.channel ?? "",
          caption,
          hashtags,
          post_type,
          scheduled_time: sv.scheduled_time ?? undefined,
        };
      }),
      images: (imgByProduct[p.id] ?? []).map((img) => ({
        id: img.id,
        product_id: img.product_id,
        asset_type: img.asset_type ?? "image",
        r2_key: img.r2_key ?? "",
        url: img.url ?? "",
        metadata: parseMetadata(img.metadata),
        created_at: img.created_at ?? "",
      })),
      posting_mode: "manual" as const,
    }));

    return c.json<ApiResponse>({ success: true, data: result });
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

interface ExportVariantRow {
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

interface ExportProductRow {
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

    const variants = extractRows<ExportVariantRow>(variantsRaw);
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

    const gProducts = extractRows<ExportProductRow>(productRaw);
    const variants = extractRows<ExportVariantRow>(variantsRaw);
    const assets = extractRows<AssetRow>(assetsRaw);
    const product = gProducts[0];
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

    const sProducts = extractRows<ExportProductRow>(productRaw);
    const variants = extractRows<ExportVariantRow>(variantsRaw);
    const assets = extractRows<AssetRow>(assetsRaw);
    const product = sProducts[0];

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
