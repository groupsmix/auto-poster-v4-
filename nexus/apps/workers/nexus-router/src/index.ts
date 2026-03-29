// ============================================================
// nexus-router Worker — Hono.js Entry Point
// The ONLY worker that receives external HTTP requests.
// All other workers are internal via Service Bindings.
//
// Routes: /api/domains, /api/categories, /api/products,
//         /api/workflow, /api/reviews, /api/publish,
//         /api/platforms, /api/social-channels, /api/prompts,
//         /api/ai, /api/assets, /api/analytics, /api/history,
//         /api/settings
// ============================================================

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "./helpers";

// ── Route modules ───────────────────────────────────────────
import domains from "./routes/domains";
import categories from "./routes/categories";
import products from "./routes/products";
import workflows from "./routes/workflows";
import reviews from "./routes/reviews";
import publishing from "./routes/publishing";
import platforms from "./routes/platforms";
import socialChannels from "./routes/social-channels";
import prompts from "./routes/prompts";
import ai from "./routes/ai";
import assets from "./routes/assets";
import analytics from "./routes/analytics";
import history from "./routes/history";
import settings from "./routes/settings";

const app = new Hono<{ Bindings: RouterEnv }>();

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS — allow dashboard origin
app.use("*", cors());

// Auth middleware — protects all /api/* routes
app.use("/api/*", async (c, next) => {
  const secret = c.env.DASHBOARD_SECRET;

  // If no secret is configured, skip auth (development mode)
  if (!secret) {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json<ApiResponse>(
      { success: false, error: "Missing Authorization header" },
      401
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== secret) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid authentication token" },
      401
    );
  }

  await next();
});

// ============================================================
// ROOT & HEALTH
// ============================================================

app.get("/", (c) => {
  return c.json({
    service: "nexus-router",
    status: "ok",
    version: "1.0.0",
    description: "NEXUS API Gateway — all routes prefixed with /api/",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// ============================================================
// MOUNT ROUTE MODULES
// ============================================================

app.route("/api/domains", domains);
app.route("/api/categories", categories);
app.route("/api/products", products);
app.route("/api/workflow", workflows);
app.route("/api/reviews", reviews);
app.route("/api/publish", publishing);
app.route("/api/platforms", platforms);
app.route("/api/social-channels", socialChannels);
app.route("/api/prompts", prompts);
app.route("/api/ai", ai);
app.route("/api/assets", assets);
app.route("/api/analytics", analytics);
app.route("/api/history", history);
app.route("/api/settings", settings);

// ============================================================
// 404 catch-all
// ============================================================

app.notFound((c) => {
  return c.json<ApiResponse>(
    {
      success: false,
      error: `Route not found: ${c.req.method} ${c.req.path}`,
    },
    404
  );
});

// ============================================================
// Global error handler
// ============================================================

app.onError((err, c) => {
  console.error("[ROUTER] Unhandled error:", err.message);
  return c.json<ApiResponse>(
    { success: false, error: "Internal server error" },
    500
  );
});

export default app;
