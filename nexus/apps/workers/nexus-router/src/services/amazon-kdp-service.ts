// ============================================================
// Amazon KDP Platform Integration
// Handles book/planner publishing preparation via Amazon KDP
// KDP doesn't have a full public API for direct product creation,
// but we prepare structured metadata and export-ready packages.
// Morocco-friendly: accepts Moroccan sellers for ebooks/planners.
// ============================================================

import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// ── Types ───────────────────────────────────────────────────

export interface AmazonKDPPublishResult {
  product_id: string;
  url: string;
  status: string;
}

interface KDPMetadata {
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  categories: string[];
  language: string;
  price: number;
  cover_image_url: string | null;
}

// ── Product Export / Upload Preparation ──────────────────────

export async function createAmazonKDPUpload(
  env: RouterEnv,
  productId: string
): Promise<AmazonKDPPublishResult> {
  // Get product info for language
  const productRows = await storageQuery<Array<{
    name: string;
    niche?: string;
    language?: string;
  }>>(
    env,
    "SELECT name, niche, language FROM products WHERE id = ? LIMIT 1",
    [productId]
  );
  const productInfo = productRows && productRows.length > 0 ? productRows[0] : undefined;

  // Get product variant data for Amazon KDP
  const variantRows = await storageQuery<Array<{
    title: string;
    description: string;
    tags: string;
    price: number;
  }>>(
    env,
    `SELECT pv.title, pv.description, pv.tags, pv.price
     FROM platform_variants pv
     JOIN platforms pl ON pl.id = pv.platform_id
     WHERE pv.product_id = ? AND pl.slug = 'amazon_kdp'
     LIMIT 1`,
    [productId]
  );

  if (!variantRows || variantRows.length === 0) {
    throw new Error("No Amazon KDP variant found for this product. Generate platform variants first.");
  }

  const variant = variantRows[0];

  // Parse tags as keywords (KDP allows up to 7 keywords)
  let keywords: string[] = [];
  try {
    const parsed: unknown = JSON.parse(variant.tags);
    keywords = Array.isArray(parsed) ? (parsed as string[]).slice(0, 7) : [];
  } catch {
    keywords = variant.tags
      ? variant.tags.split(",").map((t: string) => t.trim()).filter(Boolean).slice(0, 7)
      : [];
  }

  // Get product images (cover image)
  const assetRows = await storageQuery<Array<{ url: string }>>(
    env,
    "SELECT url FROM assets WHERE product_id = ? AND asset_type = 'image' ORDER BY created_at ASC LIMIT 1",
    [productId]
  );
  const coverImageUrl = assetRows && assetRows.length > 0 ? assetRows[0].url : null;

  // Split title into title + subtitle if it's long
  const fullTitle = variant.title.slice(0, 200);
  const colonIndex = fullTitle.indexOf(":");
  const dashIndex = fullTitle.indexOf(" - ");
  let title = fullTitle;
  let subtitle = "";

  if (colonIndex > 10 && colonIndex < fullTitle.length - 5) {
    title = fullTitle.slice(0, colonIndex).trim();
    subtitle = fullTitle.slice(colonIndex + 1).trim();
  } else if (dashIndex > 10 && dashIndex < fullTitle.length - 5) {
    title = fullTitle.slice(0, dashIndex).trim();
    subtitle = fullTitle.slice(dashIndex + 3).trim();
  }

  // Prepare KDP-ready metadata
  const kdpMetadata: KDPMetadata = {
    title,
    subtitle,
    description: variant.description,
    keywords,
    categories: productInfo?.niche ? [productInfo.niche] : [],
    language: productInfo?.language ?? "en",
    price: variant.price ?? 9.99,
    cover_image_url: coverImageUrl,
  };

  // Store the metadata as a pending upload record
  await storageQuery(
    env,
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [`kdp_upload_${productId}`, JSON.stringify(kdpMetadata)]
  );

  // Mark as ready for upload
  await storageQuery(
    env,
    `UPDATE platform_variants SET status = 'ready_for_upload', published_at = datetime('now')
     WHERE product_id = ? AND platform_id IN (SELECT id FROM platforms WHERE slug = 'amazon_kdp')`,
    [productId]
  );

  return {
    product_id: productId,
    url: "https://kdp.amazon.com/en_US/bookshelf",
    status: "ready_for_upload",
  };
}

// ── Connection Status ───────────────────────────────────────

export async function getAmazonKDPStatus(env: RouterEnv): Promise<{
  connected: boolean;
  note: string;
}> {
  const rows = await storageQuery<Array<{ key: string }>>(
    env,
    "SELECT key FROM settings WHERE key LIKE 'kdp_upload_%' LIMIT 1"
  );

  return {
    connected: true,
    note: rows && rows.length > 0
      ? "KDP metadata packages prepared. Upload via KDP Bookshelf."
      : "No uploads prepared yet. Amazon KDP requires manual upload via KDP Bookshelf.",
  };
}
