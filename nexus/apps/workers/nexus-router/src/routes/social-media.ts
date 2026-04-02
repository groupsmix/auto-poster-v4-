// ============================================================
// Social Media Auto-Posting Routes
// GET /api/social-media/connections
// GET /api/social-media/oauth-url
// POST /api/social-media/oauth-callback
// POST /api/social-media/post
// DELETE /api/social-media/connections/:id
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";
import {
  getOAuthUrl,
  exchangeOAuthCode,
  postToSocialPlatforms,
  storeOAuthCredentials,
  getConnectedPlatforms,
} from "../services/social-media-service";
import type { SocialPostPayload } from "../services/social-media-service";

const socialMedia = new Hono<{ Bindings: RouterEnv }>();

// GET /api/social-media/connections — list connected platforms
socialMedia.get("/connections", async (c) => {
  try {
    const data = await getConnectedPlatforms(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/social-media/oauth-url — get OAuth URL for a platform
socialMedia.get("/oauth-url", async (c) => {
  try {
    const platform = c.req.query("platform");
    if (!platform) {
      return c.json<ApiResponse>({ success: false, error: "platform query param is required" }, 400);
    }

    const clientId = c.env[`${platform.toUpperCase()}_CLIENT_ID`] as string | undefined;
    const redirectUri = c.req.query("redirect_uri") ?? `${c.req.url.split("/api/")[0]}/api/social-media/oauth-callback`;
    const state = `${platform}:${crypto.randomUUID()}`;

    if (!clientId) {
      return c.json<ApiResponse>({
        success: false,
        error: `${platform.toUpperCase()}_CLIENT_ID not configured. Set it in your environment.`,
      }, 400);
    }

    const url = getOAuthUrl(platform, clientId, redirectUri, state);
    if (!url) {
      return c.json<ApiResponse>({ success: false, error: `Unsupported platform: ${platform}` }, 400);
    }

    return c.json<ApiResponse>({ success: true, data: { url, state } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/social-media/oauth-callback — handle OAuth callback
socialMedia.post("/oauth-callback", async (c) => {
  try {
    const body = await c.req.json<{
      platform: string;
      code: string;
      redirect_uri: string;
    }>();

    if (!body.platform || !body.code || !body.redirect_uri) {
      return c.json<ApiResponse>({ success: false, error: "platform, code, and redirect_uri are required" }, 400);
    }

    const clientId = c.env[`${body.platform.toUpperCase()}_CLIENT_ID`] as string | undefined;
    const clientSecret = c.env[`${body.platform.toUpperCase()}_CLIENT_SECRET`] as string | undefined;

    if (!clientId || !clientSecret) {
      return c.json<ApiResponse>({
        success: false,
        error: `${body.platform.toUpperCase()}_CLIENT_ID and _CLIENT_SECRET not configured`,
      }, 400);
    }

    const tokens = await exchangeOAuthCode(
      body.platform, body.code, clientId, clientSecret, body.redirect_uri
    );

    if (!tokens) {
      return c.json<ApiResponse>({ success: false, error: "Failed to exchange OAuth code for tokens" }, 400);
    }

    const credId = await storeOAuthCredentials(
      body.platform,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in,
      body.platform, // account_id placeholder
      body.platform, // account_name placeholder
      c.env
    );

    return c.json<ApiResponse>({ success: true, data: { id: credId, platform: body.platform } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/social-media/post — post to social platforms
socialMedia.post("/post", async (c) => {
  try {
    const body = await c.req.json<{
      platforms: string[];
      text: string;
      image_url?: string;
      link_url?: string;
      tags?: string[];
      title?: string;
    }>();

    if (!body.platforms?.length || !body.text) {
      return c.json<ApiResponse>({ success: false, error: "platforms array and text are required" }, 400);
    }

    const payload: SocialPostPayload = {
      text: body.text,
      image_url: body.image_url,
      link_url: body.link_url,
      tags: body.tags,
      title: body.title,
    };

    const results = await postToSocialPlatforms(body.platforms, payload, c.env);
    const allSuccess = results.every((r) => r.success);

    return c.json<ApiResponse>({
      success: allSuccess,
      data: { results },
      error: allSuccess ? undefined : "Some posts failed — see results for details",
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/social-media/connections/:id — disconnect a platform
socialMedia.delete("/connections/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, `DELETE FROM social_credentials WHERE id = ?`, [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default socialMedia;
