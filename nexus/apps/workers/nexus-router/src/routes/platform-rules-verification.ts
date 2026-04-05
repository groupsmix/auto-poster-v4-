// ============================================================
// Platform Rules Sync Verification Routes
// GET /api/platform-rules/verify
// GET /api/platform-rules/verify/:platform
// POST /api/platform-rules/sync/:platform
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  verifyPlatformRulesSync,
  forceSyncPlatformRules,
} from "../services/platform-rules-verification-service";

const platformRulesVerification = new Hono<{ Bindings: RouterEnv }>();

// GET /api/platform-rules/verify — verify all platforms
platformRulesVerification.get("/verify", async (c) => {
  try {
    const data = await verifyPlatformRulesSync(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/platform-rules/verify/:platform — verify a specific platform
platformRulesVerification.get("/verify/:platform", async (c) => {
  try {
    const platform = c.req.param("platform");
    const data = await verifyPlatformRulesSync(c.env, [platform]);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/platform-rules/sync/:platform — force sync rules for a platform
platformRulesVerification.post("/sync/:platform", async (c) => {
  try {
    const platform = c.req.param("platform");
    const result = await forceSyncPlatformRules(platform, c.env);
    return c.json<ApiResponse>({ success: result.success, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default platformRulesVerification;
