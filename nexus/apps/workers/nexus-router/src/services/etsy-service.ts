// ============================================================
// Etsy Platform API Integration
// Handles OAuth2 PKCE flow and listing creation via Etsy Open API v3
// Docs: https://developers.etsy.com/documentation/
// ============================================================

import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";
import { resolveEtsyTaxonomyId } from "./etsy-taxonomy";

const ETSY_API_BASE = "https://openapi.etsy.com/v3";

// ── Types ───────────────────────────────────────────────────

interface EtsyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface EtsyListingPayload {
  title: string;
  description: string;
  price: number;
  quantity: number;
  tags: string[];
  who_made: "i_did" | "someone_else" | "collective";
  when_made: string;
  taxonomy_id: number;
  is_supply: boolean;
  shipping_profile_id?: number;
}

export interface EtsyPublishResult {
  listing_id: string;
  url: string;
  status: string;
}

// ── Token Management ────────────────────────────────────────

async function getStoredTokens(env: RouterEnv): Promise<EtsyTokens | null> {
  const rows = await storageQuery<{ results?: Array<{ value: string }> }>(
    env,
    "SELECT value FROM settings WHERE key = 'etsy_tokens'"
  );
  const results = rows?.results ?? [];
  if (results.length === 0) return null;
  try {
    return JSON.parse(results[0].value) as EtsyTokens;
  } catch {
    return null;
  }
}

async function storeTokens(env: RouterEnv, tokens: EtsyTokens): Promise<void> {
  await storageQuery(
    env,
    `INSERT INTO settings (key, value, updated_at) VALUES ('etsy_tokens', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify(tokens)]
  );
}

/** Maximum number of retry attempts for token refresh */
const TOKEN_REFRESH_MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms) */
const TOKEN_REFRESH_BASE_DELAY_MS = 500;

async function refreshAccessToken(env: RouterEnv, refreshToken: string): Promise<EtsyTokens> {
  const clientId = (env as Record<string, unknown>).ETSY_API_KEY as string | undefined;
  if (!clientId) throw new Error("ETSY_API_KEY not configured");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < TOKEN_REFRESH_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1000ms, 2000ms, ...
        const delay = TOKEN_REFRESH_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[ETSY] Token refresh attempt ${attempt + 1}/${TOKEN_REFRESH_MAX_RETRIES} after ${delay}ms backoff`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const resp = await fetch("https://api.etsy.com/v3/public/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: refreshToken,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        const status = resp.status;

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (status >= 400 && status < 500 && status !== 429) {
          throw new Error(`Etsy token refresh failed: ${status} ${text}`);
        }

        // Retryable error (5xx or 429)
        lastError = new Error(`Etsy token refresh failed: ${status} ${text}`);
        continue;
      }

      const data = (await resp.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      const tokens: EtsyTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };

      await storeTokens(env, tokens);
      return tokens;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // If this is a non-retryable error (thrown above), re-throw immediately
      if (lastError.message.includes("not configured") ||
          (lastError.message.includes("failed:") && /4\d{2}/.test(lastError.message) && !lastError.message.includes("429"))) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Etsy token refresh failed after retries");
}

async function getValidToken(env: RouterEnv): Promise<string> {
  const tokens = await getStoredTokens(env);
  if (!tokens) throw new Error("Etsy not connected. Complete OAuth flow first via POST /api/etsy/connect.");

  // Refresh if token expires within 5 minutes
  if (Date.now() > tokens.expires_at - 300_000) {
    const refreshed = await refreshAccessToken(env, tokens.refresh_token);
    return refreshed.access_token;
  }

  return tokens.access_token;
}

// ── OAuth2 PKCE Flow ────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function getOAuthUrl(env: RouterEnv, redirectUri: string): Promise<{ url: string; state: string }> {
  const clientId = (env as Record<string, unknown>).ETSY_API_KEY as string | undefined;
  if (!clientId) throw new Error("ETSY_API_KEY not configured");

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  // Store verifier in settings with created_at timestamp for expiry cleanup
  await storageQuery(
    env,
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [`etsy_pkce_${state}`, JSON.stringify({
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      created_at: Date.now(),
    })]
  );

  // Clean up expired PKCE entries (older than 10 minutes)
  await storageQuery(
    env,
    `DELETE FROM settings WHERE key LIKE 'etsy_pkce_%' AND updated_at < datetime('now', '-10 minutes')`
  ).catch(() => {
    // Non-critical cleanup — log and continue
    console.log("[ETSY] Could not clean up expired PKCE entries");
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "listings_w listings_r shops_r",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    url: `https://www.etsy.com/oauth/connect?${params.toString()}`,
    state,
  };
}

export async function handleOAuthCallback(
  env: RouterEnv,
  code: string,
  state: string
): Promise<{ shop_id: string }> {
  const clientId = (env as Record<string, unknown>).ETSY_API_KEY as string | undefined;
  if (!clientId) throw new Error("ETSY_API_KEY not configured");

  // Retrieve stored PKCE verifier
  const pkceRows = await storageQuery<{ results?: Array<{ value: string }> }>(
    env,
    "SELECT value FROM settings WHERE key = ?",
    [`etsy_pkce_${state}`]
  );
  const pkceResults = pkceRows?.results ?? [];
  if (pkceResults.length === 0) throw new Error("Invalid or expired OAuth state");

  const { code_verifier, redirect_uri } = JSON.parse(pkceResults[0].value) as {
    code_verifier: string;
    redirect_uri: string;
  };

  // Exchange code for tokens
  const resp = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri,
      code,
      code_verifier,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Etsy token exchange failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokens: EtsyTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await storeTokens(env, tokens);

  // Clean up PKCE state
  await storageQuery(env, "DELETE FROM settings WHERE key = ?", [`etsy_pkce_${state}`]);

  // Get shop ID
  const shopResp = await fetch(`${ETSY_API_BASE}/application/users/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, "x-api-key": clientId },
  });
  const shopData = (await shopResp.json()) as { user_id?: number; shop_id?: string };
  const shopId = String(shopData.shop_id ?? shopData.user_id ?? "unknown");

  // Store shop ID
  await storageQuery(
    env,
    `INSERT INTO settings (key, value, updated_at) VALUES ('etsy_shop_id', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [shopId]
  );

  return { shop_id: shopId };
}

// ── Listing Creation ────────────────────────────────────────

export async function createEtsyListing(
  env: RouterEnv,
  productId: string
): Promise<EtsyPublishResult> {
  const clientId = (env as Record<string, unknown>).ETSY_API_KEY as string | undefined;
  if (!clientId) throw new Error("ETSY_API_KEY not configured");

  const accessToken = await getValidToken(env);

  // Get shop ID
  const shopRows = await storageQuery<{ results?: Array<{ value: string }> }>(
    env,
    "SELECT value FROM settings WHERE key = 'etsy_shop_id'"
  );
  const shopResults = shopRows?.results ?? [];
  if (shopResults.length === 0) throw new Error("Etsy shop not connected");
  const shopId = shopResults[0].value;

  // Get product domain/category info for taxonomy mapping
  const productRows = await storageQuery<Array<{
    domain_slug?: string;
    category_slug?: string;
    domain_name?: string;
    category_name?: string;
  }>>(
    env,
    `SELECT d.slug as domain_slug, c.slug as category_slug, d.name as domain_name, c.name as category_name
     FROM products p
     LEFT JOIN domains d ON d.id = p.domain_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [productId]
  );
  const productInfo = Array.isArray(productRows) ? productRows[0] : undefined;

  // Get product variant data for Etsy
  const variantRows = await storageQuery<{ results?: Array<{
    title: string;
    description: string;
    tags: string;
    price: number;
    platform_slug?: string;
  }> }>(
    env,
    `SELECT pv.title, pv.description, pv.tags, pv.price, pl.slug as platform_slug
     FROM platform_variants pv
     JOIN platforms pl ON pl.id = pv.platform_id
     WHERE pv.product_id = ? AND pl.slug = 'etsy'
     LIMIT 1`,
    [productId]
  );

  const variants = variantRows?.results ?? [];
  if (variants.length === 0) {
    throw new Error("No Etsy variant found for this product. Generate platform variants first.");
  }

  const variant = variants[0];

  // Parse tags
  let tags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(variant.tags);
    tags = Array.isArray(parsed) ? (parsed as string[]).slice(0, 13) : [];
  } catch {
    tags = variant.tags
      ? variant.tags.split(",").map((t: string) => t.trim()).filter(Boolean).slice(0, 13)
      : [];
  }

  const payload: EtsyListingPayload = {
    title: variant.title.slice(0, 140),
    description: variant.description,
    price: variant.price ?? 9.99,
    quantity: 999,
    tags,
    who_made: "i_did",
    when_made: "2020_2025",
    taxonomy_id: resolveEtsyTaxonomyId(
      productInfo?.domain_slug,
      productInfo?.category_slug,
      productInfo?.category_name,
      productInfo?.domain_name
    ),
    is_supply: false,
  };

  // Create the listing via Etsy API
  const resp = await fetch(`${ETSY_API_BASE}/application/shops/${shopId}/listings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-api-key": clientId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Etsy listing creation failed: ${resp.status} ${text}`);
  }

  const listing = (await resp.json()) as { listing_id: number; url: string; state: string };

  // Upload images if available
  const assetRows = await storageQuery<{ results?: Array<{ url: string; r2_key: string }> }>(
    env,
    "SELECT url, r2_key FROM assets WHERE product_id = ? AND asset_type = 'image' ORDER BY created_at ASC LIMIT 10",
    [productId]
  );

  const assets = assetRows?.results ?? [];
  for (let i = 0; i < assets.length; i++) {
    try {
      const imageResp = await fetch(assets[i].url);
      if (!imageResp.ok) continue;
      const imageBlob = await imageResp.blob();

      const formData = new FormData();
      formData.append("image", imageBlob, `image-${i}.png`);
      formData.append("rank", String(i + 1));

      await fetch(
        `${ETSY_API_BASE}/application/shops/${shopId}/listings/${listing.listing_id}/images`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-api-key": clientId,
          },
          body: formData,
        }
      );
    } catch (imgErr) {
      console.error(`[ETSY] Image upload ${i} failed:`, imgErr);
    }
  }

  // Update platform variant status
  await storageQuery(
    env,
    `UPDATE platform_variants SET status = 'published', published_at = datetime('now')
     WHERE product_id = ? AND platform_id IN (SELECT id FROM platforms WHERE slug = 'etsy')`,
    [productId]
  );

  return {
    listing_id: String(listing.listing_id),
    url: listing.url ?? `https://www.etsy.com/listing/${listing.listing_id}`,
    status: listing.state,
  };
}

// ── Connection Status ───────────────────────────────────────

export async function getEtsyStatus(env: RouterEnv): Promise<{
  connected: boolean;
  shop_id?: string;
  token_expires_at?: number;
}> {
  const tokens = await getStoredTokens(env);
  if (!tokens) return { connected: false };

  const shopRows = await storageQuery<{ results?: Array<{ value: string }> }>(
    env,
    "SELECT value FROM settings WHERE key = 'etsy_shop_id'"
  );
  const shopResults = shopRows?.results ?? [];

  return {
    connected: true,
    shop_id: shopResults[0]?.value,
    token_expires_at: tokens.expires_at,
  };
}
