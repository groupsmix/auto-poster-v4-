// ============================================================
// Etsy Platform API Routes
// OAuth2 PKCE connection + listing creation
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  getOAuthUrl,
  handleOAuthCallback,
  createEtsyListing,
  getEtsyStatus,
} from "../services/etsy-service";

const etsy = new Hono<{ Bindings: RouterEnv }>();

// GET /api/etsy/status — check Etsy connection status
etsy.get("/status", async (c) => {
  try {
    const status = await getEtsyStatus(c.env);
    return c.json<ApiResponse>({ success: true, data: status });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/etsy/connect — initiate OAuth2 PKCE flow
etsy.post("/connect", async (c) => {
  try {
    const body = await c.req.json<{ redirect_uri: string }>();
    const redirectUri = body.redirect_uri;
    if (!redirectUri) {
      return errorResponse(c, new Error("redirect_uri is required"), 400);
    }
    const result = await getOAuthUrl(c.env, redirectUri);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/etsy/callback — handle OAuth2 callback
etsy.post("/callback", async (c) => {
  try {
    const body = await c.req.json<{ code: string; state: string }>();
    if (!body.code || !body.state) {
      return errorResponse(c, new Error("code and state are required"), 400);
    }
    const result = await handleOAuthCallback(c.env, body.code, body.state);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/etsy/publish/:productId — create listing on Etsy
etsy.post("/publish/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");
    const result = await createEtsyListing(c.env, productId);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default etsy;
