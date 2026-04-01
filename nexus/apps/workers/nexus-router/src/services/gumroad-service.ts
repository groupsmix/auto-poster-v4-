// ============================================================
// Gumroad Platform API Integration
// Handles product creation via Gumroad API v2
// Docs: https://app.gumroad.com/api
// Morocco-friendly: supports PayPal payouts worldwide
// ============================================================

import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

const GUMROAD_API_BASE = "https://api.gumroad.com/v2";

// ── Types ───────────────────────────────────────────────────

export interface GumroadPublishResult {
  product_id: string;
  url: string;
  status: string;
}

// ── Token Management ────────────────────────────────────────

async function getGumroadToken(env: RouterEnv): Promise<string> {
  const rows = await storageQuery<Array<{ value: string }>>(
    env,
    "SELECT value FROM settings WHERE key = 'gumroad_access_token' LIMIT 1"
  );
  if (!rows || rows.length === 0) {
    throw new Error("Gumroad not connected. Add your Gumroad access token in Settings.");
  }
  return rows[0].value;
}

// ── Product Creation ────────────────────────────────────────

export async function createGumroadProduct(
  env: RouterEnv,
  productId: string
): Promise<GumroadPublishResult> {
  const accessToken = await getGumroadToken(env);

  // Get product variant data for Gumroad
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
     WHERE pv.product_id = ? AND pl.slug = 'gumroad'
     LIMIT 1`,
    [productId]
  );

  if (!variantRows || variantRows.length === 0) {
    throw new Error("No Gumroad variant found for this product. Generate platform variants first.");
  }

  const variant = variantRows[0];

  // Parse tags
  let tags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(variant.tags);
    tags = Array.isArray(parsed) ? (parsed as string[]).slice(0, 10) : [];
  } catch {
    tags = variant.tags
      ? variant.tags.split(",").map((t: string) => t.trim()).filter(Boolean).slice(0, 10)
      : [];
  }

  // Get product images
  const assetRows = await storageQuery<Array<{ url: string }>>(
    env,
    "SELECT url FROM assets WHERE product_id = ? AND asset_type = 'image' ORDER BY created_at ASC LIMIT 1",
    [productId]
  );
  const previewUrl = assetRows && assetRows.length > 0 ? assetRows[0].url : undefined;

  // Create product via Gumroad API
  const formData = new URLSearchParams();
  formData.append("access_token", accessToken);
  formData.append("name", variant.title.slice(0, 100));
  formData.append("description", variant.description);
  formData.append("price", String(Math.round((variant.price ?? 9.99) * 100))); // Gumroad uses cents
  formData.append("published", "true");
  if (tags.length > 0) {
    formData.append("tags", tags.join(","));
  }
  if (previewUrl) {
    formData.append("preview_url", previewUrl);
  }

  const resp = await fetch(`${GUMROAD_API_BASE}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gumroad product creation failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    success: boolean;
    product: { id: string; short_url: string; published: boolean };
  };

  if (!data.success) {
    throw new Error("Gumroad product creation failed: API returned success=false");
  }

  // Update platform variant status
  await storageQuery(
    env,
    `UPDATE platform_variants SET status = 'published', published_at = datetime('now')
     WHERE product_id = ? AND platform_id IN (SELECT id FROM platforms WHERE slug = 'gumroad')`,
    [productId]
  );

  return {
    product_id: data.product.id,
    url: data.product.short_url,
    status: data.product.published ? "published" : "draft",
  };
}

// ── Connection Status ───────────────────────────────────────

export async function getGumroadStatus(env: RouterEnv): Promise<{
  connected: boolean;
  email?: string;
}> {
  try {
    const token = await getGumroadToken(env);
    const resp = await fetch(`${GUMROAD_API_BASE}/user`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) return { connected: false };

    const data = (await resp.json()) as {
      success: boolean;
      user?: { email?: string };
    };

    return {
      connected: data.success,
      email: data.user?.email,
    };
  } catch {
    return { connected: false };
  }
}
