// ============================================================
// Redbubble Platform Integration
// Redbubble does NOT have an official public API for product creation.
// This service prepares upload-ready data packages and provides
// export functionality. Auto-publish creates a structured payload
// that can be used with Redbubble's bulk upload or browser automation.
// Morocco-friendly: PayPal payouts, no seller restrictions.
// ============================================================

import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// ── Types ───────────────────────────────────────────────────

export interface RedbubblePublishResult {
  product_id: string;
  url: string;
  status: string;
}

interface RedbubbleUploadPayload {
  title: string;
  description: string;
  tags: string[];
  image_url: string | null;
  default_products: string[];
}

// ── Product Export / Upload Preparation ──────────────────────

export async function createRedbubbleUpload(
  env: RouterEnv,
  productId: string
): Promise<RedbubblePublishResult> {
  // Get product variant data for Redbubble
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
     WHERE pv.product_id = ? AND pl.slug = 'redbubble'
     LIMIT 1`,
    [productId]
  );

  if (!variantRows || variantRows.length === 0) {
    throw new Error("No Redbubble variant found for this product. Generate platform variants first.");
  }

  const variant = variantRows[0];

  // Parse tags
  let tags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(variant.tags);
    tags = Array.isArray(parsed) ? (parsed as string[]).slice(0, 15) : [];
  } catch {
    tags = variant.tags
      ? variant.tags.split(",").map((t: string) => t.trim()).filter(Boolean).slice(0, 15)
      : [];
  }

  // Get product images
  const assetRows = await storageQuery<Array<{ url: string; r2_key: string }>>(
    env,
    "SELECT url, r2_key FROM assets WHERE product_id = ? AND asset_type = 'image' ORDER BY created_at ASC LIMIT 1",
    [productId]
  );
  const imageUrl = assetRows && assetRows.length > 0 ? assetRows[0].url : null;

  // Prepare Redbubble-ready upload payload
  const uploadPayload: RedbubbleUploadPayload = {
    title: variant.title.slice(0, 60),
    description: variant.description,
    tags,
    image_url: imageUrl,
    default_products: [
      "t-shirt", "sticker", "poster", "phone-case", "tote-bag",
      "throw-pillow", "mug", "notebook", "art-print", "canvas-print",
    ],
  };

  // Store the upload payload as a pending upload record
  const uploadId = crypto.randomUUID();
  await storageQuery(
    env,
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [`redbubble_upload_${productId}`, JSON.stringify(uploadPayload)]
  );

  // Mark as ready for manual upload (since no API exists)
  await storageQuery(
    env,
    `UPDATE platform_variants SET status = 'ready_for_upload', published_at = datetime('now')
     WHERE product_id = ? AND platform_id IN (SELECT id FROM platforms WHERE slug = 'redbubble')`,
    [productId]
  );

  return {
    product_id: uploadId,
    url: `https://www.redbubble.com/portfolio/images/new`,
    status: "ready_for_upload",
  };
}

// ── Connection Status ───────────────────────────────────────

export async function getRedbubbleStatus(env: RouterEnv): Promise<{
  connected: boolean;
  note: string;
}> {
  // Redbubble doesn't have a public API, so we check if any uploads have been prepared
  const rows = await storageQuery<Array<{ key: string }>>(
    env,
    "SELECT key FROM settings WHERE key LIKE 'redbubble_upload_%' LIMIT 1"
  );

  return {
    connected: true,
    note: rows && rows.length > 0
      ? "Upload payloads prepared. Use Redbubble's upload page to publish."
      : "No uploads prepared yet. Redbubble requires manual upload (no public API).",
  };
}
