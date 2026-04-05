// ============================================================
// Social Media Auto-Posting Service
// API integrations for Instagram, Twitter/X, TikTok, LinkedIn,
// Facebook, YouTube. OAuth flow management.
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Types ---

export interface SocialCredential {
  id: string;
  platform: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  account_id?: string;
  account_name?: string;
  scopes?: string;
  created_at: string;
  updated_at: string;
}

export interface SocialPostResult {
  platform: string;
  success: boolean;
  post_id?: string;
  post_url?: string;
  error?: string;
}

export interface SocialPostPayload {
  text: string;
  image_url?: string;
  link_url?: string;
  tags?: string[];
  title?: string;
}

// --- OAuth URL builders ---

export function getOAuthUrl(
  platform: string,
  clientId: string,
  redirectUri: string,
  state: string
): string | null {
  const encodedRedirect = encodeURIComponent(redirectUri);
  const encodedState = encodeURIComponent(state);

  switch (platform) {
    case "instagram":
    case "facebook":
      return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodedRedirect}&state=${encodedState}&scope=pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish`;
    case "twitter":
      return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodedRedirect}&state=${encodedState}&scope=tweet.read%20tweet.write%20users.read%20offline.access&code_challenge=challenge&code_challenge_method=plain`;
    case "linkedin":
      return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodedRedirect}&state=${encodedState}&scope=w_member_social%20r_liteprofile`;
    case "tiktok":
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientId}&response_type=code&redirect_uri=${encodedRedirect}&state=${encodedState}&scope=video.publish,video.upload`;
    case "youtube":
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodedRedirect}&state=${encodedState}&scope=https://www.googleapis.com/auth/youtube.upload&response_type=code&access_type=offline`;
    default:
      return null;
  }
}

// --- Token exchange ---

export async function exchangeOAuthCode(
  platform: string,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
} | null> {
  let tokenUrl: string;
  let body: Record<string, string>;

  switch (platform) {
    case "instagram":
    case "facebook":
      tokenUrl = "https://graph.facebook.com/v18.0/oauth/access_token";
      body = { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" };
      break;
    case "twitter":
      tokenUrl = "https://api.twitter.com/2/oauth2/token";
      body = { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: "challenge" };
      break;
    case "linkedin":
      tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
      body = { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" };
      break;
    case "tiktok":
      tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
      body = { client_key: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" };
      break;
    case "youtube":
      tokenUrl = "https://oauth2.googleapis.com/token";
      body = { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" };
      break;
    default:
      return null;
  }

  try {
    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) return null;
    return data as { access_token: string; refresh_token?: string; expires_in?: number };
  } catch {
    return null;
  }
}

// --- Platform-specific posting ---

async function postToTwitter(
  token: string,
  payload: SocialPostPayload
): Promise<SocialPostResult> {
  try {
    const tweetText = payload.tags?.length
      ? `${payload.text}\n\n${payload.tags.map((t) => `#${t}`).join(" ")}`
      : payload.text;

    const resp = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: tweetText.slice(0, 280) }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { platform: "twitter", success: false, error: `Twitter API: ${resp.status} - ${err}` };
    }

    const data = (await resp.json()) as { data?: { id?: string } };
    return {
      platform: "twitter",
      success: true,
      post_id: data.data?.id,
      post_url: data.data?.id ? `https://twitter.com/i/web/status/${data.data.id}` : undefined,
    };
  } catch (err) {
    return { platform: "twitter", success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function postToFacebook(
  token: string,
  pageId: string,
  payload: SocialPostPayload
): Promise<SocialPostResult> {
  try {
    const message = payload.tags?.length
      ? `${payload.text}\n\n${payload.tags.map((t) => `#${t}`).join(" ")}`
      : payload.text;

    const body: Record<string, string> = { message, access_token: token };
    if (payload.link_url) body.link = payload.link_url;

    const resp = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { platform: "facebook", success: false, error: `Facebook API: ${resp.status} - ${err}` };
    }

    const data = (await resp.json()) as { id?: string };
    return {
      platform: "facebook",
      success: true,
      post_id: data.id,
      post_url: data.id ? `https://facebook.com/${data.id}` : undefined,
    };
  } catch (err) {
    return { platform: "facebook", success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function postToLinkedIn(
  token: string,
  authorUrn: string,
  payload: SocialPostPayload
): Promise<SocialPostResult> {
  try {
    const text = payload.tags?.length
      ? `${payload.text}\n\n${payload.tags.map((t) => `#${t}`).join(" ")}`
      : payload.text;

    const body: Record<string, unknown> = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { platform: "linkedin", success: false, error: `LinkedIn API: ${resp.status} - ${err}` };
    }

    const data = (await resp.json()) as { id?: string };
    return { platform: "linkedin", success: true, post_id: data.id };
  } catch (err) {
    return { platform: "linkedin", success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function postToInstagram(
  token: string,
  igUserId: string,
  payload: SocialPostPayload
): Promise<SocialPostResult> {
  try {
    if (!payload.image_url) {
      return { platform: "instagram", success: false, error: "Instagram requires an image_url" };
    }

    const caption = payload.tags?.length
      ? `${payload.text}\n\n${payload.tags.map((t) => `#${t}`).join(" ")}`
      : payload.text;

    // Step 1: Create media container
    const createResp = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: payload.image_url,
          caption,
          access_token: token,
        }),
      }
    );

    if (!createResp.ok) {
      const err = await createResp.text();
      return { platform: "instagram", success: false, error: `IG media create: ${createResp.status} - ${err}` };
    }

    const createData = (await createResp.json()) as { id?: string };
    if (!createData.id) {
      return { platform: "instagram", success: false, error: "Failed to create media container" };
    }

    // Step 2: Publish the container
    const publishResp = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: token,
        }),
      }
    );

    if (!publishResp.ok) {
      const err = await publishResp.text();
      return { platform: "instagram", success: false, error: `IG publish: ${publishResp.status} - ${err}` };
    }

    const publishData = (await publishResp.json()) as { id?: string };
    return {
      platform: "instagram",
      success: true,
      post_id: publishData.id,
      post_url: publishData.id ? `https://www.instagram.com/p/${publishData.id}/` : undefined,
    };
  } catch (err) {
    return { platform: "instagram", success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Main posting function ---

/**
 * Post content to one or more social platforms.
 */
export async function postToSocialPlatforms(
  platforms: string[],
  payload: SocialPostPayload,
  env: RouterEnv
): Promise<SocialPostResult[]> {
  const results: SocialPostResult[] = [];

  for (const platform of platforms) {
    // Get stored credentials
    const creds = (await storageQuery<Array<{
      access_token: string;
      account_id: string;
      account_name: string;
    }>>(
      env,
      `SELECT access_token, account_id, account_name FROM social_credentials WHERE platform = ? AND is_active = 1 LIMIT 1`,
      [platform]
    )) ?? [];

    if (creds.length === 0) {
      results.push({
        platform,
        success: false,
        error: `No credentials configured for ${platform}. Please connect via OAuth.`,
      });
      continue;
    }

    const cred = creds[0];

    switch (platform) {
      case "twitter":
        results.push(await postToTwitter(cred.access_token, payload));
        break;
      case "facebook":
        results.push(await postToFacebook(cred.access_token, cred.account_id, payload));
        break;
      case "instagram":
        results.push(await postToInstagram(cred.access_token, cred.account_id, payload));
        break;
      case "linkedin":
        results.push(await postToLinkedIn(cred.access_token, cred.account_id, payload));
        break;
      case "tiktok":
        results.push({ platform: "tiktok", success: false, error: "TikTok video posting requires video upload — use the TikTok dashboard" });
        break;
      case "youtube":
        results.push({ platform: "youtube", success: false, error: "YouTube posting requires video upload — use the YouTube dashboard" });
        break;
      default:
        results.push({ platform, success: false, error: `Unsupported platform: ${platform}` });
    }

    // Log the post result
    const lastResult = results[results.length - 1];
    await storageQuery(
      env,
      `INSERT INTO social_post_logs (id, platform, status, post_id, post_url, error, posted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        platform,
        lastResult.success ? "posted" : "failed",
        lastResult.post_id ?? null,
        lastResult.post_url ?? null,
        lastResult.error ?? null,
        now(),
      ]
    );
  }

  return results;
}

/**
 * Store OAuth credentials after successful token exchange.
 */
export async function storeOAuthCredentials(
  platform: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number | undefined,
  accountId: string,
  accountName: string,
  env: RouterEnv
): Promise<string> {
  const id = generateId();
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Deactivate any existing credentials for this platform
  await storageQuery(
    env,
    `UPDATE social_credentials SET is_active = 0, updated_at = ? WHERE platform = ?`,
    [now(), platform]
  );

  await storageQuery(
    env,
    `INSERT INTO social_credentials (id, platform, access_token, refresh_token, expires_at, account_id, account_name, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, platform, accessToken, refreshToken ?? null, expiresAt, accountId, accountName, now(), now()]
  );

  return id;
}

/**
 * Get all connected social platform credentials (redacted tokens).
 */
export async function getConnectedPlatforms(
  env: RouterEnv
): Promise<Array<{
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}>> {
  return (await storageQuery<Array<{
    id: string;
    platform: string;
    account_name: string;
    account_id: string;
    is_active: boolean;
    expires_at: string | null;
    created_at: string;
  }>>(
    env,
    `SELECT id, platform, account_name, account_id, is_active, expires_at, created_at
     FROM social_credentials
     ORDER BY created_at DESC`
  )) ?? [];
}
