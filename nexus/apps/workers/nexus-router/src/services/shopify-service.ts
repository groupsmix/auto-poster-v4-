// ============================================================
// Shopify Platform API Integration
// Handles product creation via Shopify Admin API
// Docs: https://shopify.dev/docs/api/admin-rest
// Requires: store URL + access token (from custom app or API key)
// ============================================================

import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// ── Types ───────────────────────────────────────────────────

export interface ShopifyPublishResult {
  product_id: string;
  url: string;
  status: string;
}

// ── Credential Management ───────────────────────────────────

interface ShopifyCredentials {
  store_url: string; // e.g. "my-store.myshopify.com"
  access_token: string;
}

async function getShopifyCredentials(env: RouterEnv): Promise<ShopifyCredentials> {
  const rows = await storageQuery<Array<{ key: string; value: string }>>(
    env,
    "SELECT key, value FROM settings WHERE key IN ('shopify_store_url', 'shopify_access_token')"
  );

  if (!rows || rows.length < 2) {
    throw new Error("Shopify not connected. Add your Shopify store URL and access token in Settings.");
  }

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  if (!map.shopify_store_url || !map.shopify_access_token) {
    throw new Error("Shopify not connected. Both store URL and access token are required.");
  }

  return {
    store_url: map.shopify_store_url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    access_token: map.shopify_access_token,
  };
}

// ── Product Creation ────────────────────────────────────────

export async function createShopifyProduct(
  env: RouterEnv,
  productId: string
): Promise<ShopifyPublishResult> {
  const creds = await getShopifyCredentials(env);

  // Get product info
  const productRows = await storageQuery<Array<{ niche?: string }>>(
    env,
    "SELECT niche FROM products WHERE id = ? LIMIT 1",
    [productId]
  );
  const productInfo = productRows && productRows.length > 0 ? productRows[0] : undefined;

  // Get product variant data for Shopify
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
     WHERE pv.product_id = ? AND pl.slug = 'shopify'
     LIMIT 1`,
    [productId]
  );

  if (!variantRows || variantRows.length === 0) {
    throw new Error("No Shopify variant found for this product. Generate platform variants first.");
  }

  const variant = variantRows[0];

  // Parse tags
  let tags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(variant.tags);
    tags = Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    tags = variant.tags
      ? variant.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];
  }

  // Get product images
  const assetRows = await storageQuery<Array<{ url: string; alt_text?: string }>>(
    env,
    "SELECT url, alt_text FROM assets WHERE product_id = ? AND asset_type = 'image' ORDER BY created_at ASC LIMIT 10",
    [productId]
  );

  const images = (assetRows ?? []).map((a) => ({
    src: a.url,
    alt: a.alt_text ?? "",
  }));

  // Create product via Shopify Admin API
  const shopifyPayload = {
    product: {
      title: variant.title.slice(0, 70),
      body_html: variant.description,
      vendor: "",
      product_type: productInfo?.niche ?? "",
      tags: tags.join(", "),
      variants: [
        {
          title: "Default",
          price: String(variant.price ?? 9.99),
          sku: "",
          inventory_quantity: 999,
          inventory_management: null,
        },
      ],
      images,
      published: true,
    },
  };

  const resp = await fetch(
    `https://${creds.store_url}/admin/api/2024-01/products.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": creds.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shopifyPayload),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Shopify product creation failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    product: { id: number; handle: string; status: string };
  };

  const productUrl = `https://${creds.store_url}/products/${data.product.handle}`;

  // Update platform variant status
  await storageQuery(
    env,
    `UPDATE platform_variants SET status = 'published', published_at = datetime('now')
     WHERE product_id = ? AND platform_id IN (SELECT id FROM platforms WHERE slug = 'shopify')`,
    [productId]
  );

  return {
    product_id: String(data.product.id),
    url: productUrl,
    status: data.product.status,
  };
}

// ── Connection Status ───────────────────────────────────────

export async function getShopifyStatus(env: RouterEnv): Promise<{
  connected: boolean;
  store_url?: string;
}> {
  try {
    const creds = await getShopifyCredentials(env);

    const resp = await fetch(
      `https://${creds.store_url}/admin/api/2024-01/shop.json`,
      {
        headers: { "X-Shopify-Access-Token": creds.access_token },
      }
    );

    return {
      connected: resp.ok,
      store_url: creds.store_url,
    };
  } catch {
    return { connected: false };
  }
}
