// ============================================================
// Pinterest Platform API Integration
// Handles pin creation via Pinterest API v5
// Docs: https://developers.pinterest.com/docs/api/v5/
// Used as a free traffic driver to any store
// ============================================================

import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

// ── Types ───────────────────────────────────────────────────

export interface PinterestPublishResult {
  pin_id: string;
  url: string;
  status: string;
}

// ── Token Management ────────────────────────────────────────

async function getPinterestToken(env: RouterEnv): Promise<string> {
  const rows = await storageQuery<Array<{ value: string }>>(
    env,
    "SELECT value FROM settings WHERE key = 'pinterest_access_token' LIMIT 1"
  );
  if (!rows || rows.length === 0) {
    throw new Error("Pinterest not connected. Add your Pinterest access token in Settings.");
  }
  return rows[0].value;
}

async function getPinterestBoardId(env: RouterEnv): Promise<string> {
  const rows = await storageQuery<Array<{ value: string }>>(
    env,
    "SELECT value FROM settings WHERE key = 'pinterest_board_id' LIMIT 1"
  );
  if (!rows || rows.length === 0) {
    throw new Error("Pinterest board not configured. Set your Pinterest board ID in Settings.");
  }
  return rows[0].value;
}

// ── Pin Creation ────────────────────────────────────────────

export async function createPinterestPin(
  env: RouterEnv,
  productId: string
): Promise<PinterestPublishResult> {
  const accessToken = await getPinterestToken(env);
  const boardId = await getPinterestBoardId(env);

  // Get product variant data for Pinterest
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
     WHERE pv.product_id = ? AND pl.slug = 'pinterest'
     LIMIT 1`,
    [productId]
  );

  if (!variantRows || variantRows.length === 0) {
    throw new Error("No Pinterest variant found for this product. Generate platform variants first.");
  }

  const variant = variantRows[0];

  // Get product images (Pinterest requires an image)
  const assetRows = await storageQuery<Array<{ url: string }>>(
    env,
    "SELECT url FROM assets WHERE product_id = ? AND asset_type = 'image' ORDER BY created_at ASC LIMIT 1",
    [productId]
  );

  if (!assetRows || assetRows.length === 0) {
    throw new Error("No image found for this product. Pinterest pins require an image.");
  }

  const imageUrl = assetRows[0].url;

  // Get the product's external URL (e.g., Gumroad, Shopify link) for the pin link
  const externalUrlRows = await storageQuery<Array<{ external_url: string }>>(
    env,
    `SELECT pv.external_url FROM platform_variants pv
     JOIN platforms pl ON pl.id = pv.platform_id
     WHERE pv.product_id = ? AND pv.external_url IS NOT NULL
     ORDER BY pv.published_at DESC LIMIT 1`,
    [productId]
  );
  const linkUrl = externalUrlRows && externalUrlRows.length > 0
    ? externalUrlRows[0].external_url
    : undefined;

  // Create pin via Pinterest API
  const pinPayload: Record<string, unknown> = {
    board_id: boardId,
    title: variant.title.slice(0, 100),
    description: variant.description.slice(0, 500),
    media_source: {
      source_type: "image_url",
      url: imageUrl,
    },
  };

  if (linkUrl) {
    pinPayload.link = linkUrl;
  }

  const resp = await fetch(`${PINTEREST_API_BASE}/pins`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pinPayload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Pinterest pin creation failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    id: string;
    link?: string;
    board_id: string;
  };

  const pinUrl = `https://www.pinterest.com/pin/${data.id}/`;

  // Update platform variant status
  await storageQuery(
    env,
    `UPDATE platform_variants SET status = 'published', published_at = datetime('now')
     WHERE product_id = ? AND platform_id IN (SELECT id FROM platforms WHERE slug = 'pinterest')`,
    [productId]
  );

  return {
    pin_id: data.id,
    url: pinUrl,
    status: "published",
  };
}

// ── Connection Status ───────────────────────────────────────

export async function getPinterestStatus(env: RouterEnv): Promise<{
  connected: boolean;
  board_id?: string;
}> {
  try {
    const token = await getPinterestToken(env);

    const resp = await fetch(`${PINTEREST_API_BASE}/user_account`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) return { connected: false };

    let boardId: string | undefined;
    try {
      boardId = await getPinterestBoardId(env);
    } catch {
      // Board not configured yet
    }

    return {
      connected: true,
      board_id: boardId,
    };
  } catch {
    return { connected: false };
  }
}
