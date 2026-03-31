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
import exportRoutes from "./routes/export";
import apiKeys from "./routes/api-keys";
import aiCeo from "./routes/ai-ceo";

const app = new Hono<{ Bindings: RouterEnv; Variables: { requestId: string } }>();

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS — restrict to known dashboard origins (supports custom domain via env)
app.use("*", async (c, next) => {
  const customOrigin = c.env.CUSTOM_DOMAIN_ORIGIN;
  return cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (
        origin.endsWith(".pages.dev") ||
        origin.endsWith(".workers.dev") ||
        origin.startsWith("http://localhost") ||
        (customOrigin && origin === customOrigin)
      ) {
        return origin;
      }
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposeHeaders: ["X-Request-ID"],
    maxAge: 86400,
  })(c, next);
});

// Request ID tracing middleware — generate or propagate X-Request-ID
app.use("/api/*", async (c, next) => {
  const requestId =
    c.req.header("X-Request-ID") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});

// Request/response logging middleware (7.4)
app.use("/api/*", async (c, next) => {
  const start = Date.now();
  const requestId = c.get("requestId") ?? "-";
  await next();
  const duration = Date.now() - start;
  console.log(
    `[${requestId}] ${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`
  );
});

// Rate limiting middleware (7.3)
// 20 requests per minute per IP using KV counter
app.use("/api/*", async (c, next) => {
  const storage = c.env.NEXUS_STORAGE;
  if (!storage) {
    await next();
    return;
  }

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const minute = Math.floor(Date.now() / 60000);
  const key = `ratelimit:${ip}:${minute}`;

  try {
    const resp = await storage.fetch(`http://nexus-storage/kv/${encodeURIComponent(key)}`);
    const json = (await resp.json()) as { success: boolean; data?: string };
    const count = json.success && json.data ? parseInt(json.data as string, 10) : 0;

    if (count >= 20) {
      return c.json<ApiResponse>(
        { success: false, error: "Rate limit exceeded. Try again in a minute." },
        429
      );
    }

    // Increment counter — await the write to prevent races
    await storage.fetch(`http://nexus-storage/kv/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: String(count + 1), ttl: 120 }),
    });
  } catch {
    // If rate limit check fails, allow the request through
  }

  await next();
});

// Auth middleware — protects all /api/* routes
app.use("/api/*", async (c, next) => {
  const secret = c.env.DASHBOARD_SECRET;

  // Fail closed — if no secret is configured, block all requests
  if (!secret) {
    return c.json<ApiResponse>(
      { success: false, error: "Authentication not configured. Set DASHBOARD_SECRET." },
      503
    );
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json<ApiResponse>(
      { success: false, error: "Missing Authorization header" },
      401
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Use constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(token);
  const secretBytes = encoder.encode(secret);
  if (tokenBytes.byteLength !== secretBytes.byteLength) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid authentication token" },
      401
    );
  }
  // Constant-time byte comparison (prevents timing side-channel)
  let mismatch = 0;
  for (let i = 0; i < tokenBytes.byteLength; i++) {
    mismatch |= tokenBytes[i] ^ secretBytes[i];
  }
  if (mismatch !== 0) {
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

app.get("/health", async (c) => {
  const checks = await Promise.allSettled([
    c.env.NEXUS_STORAGE.fetch("http://nexus-storage/health"),
    c.env.NEXUS_AI.fetch("http://nexus-ai/health"),
    c.env.NEXUS_WORKFLOW.fetch("http://nexus-workflow/health"),
  ]);

  const results = {
    storage: checks[0].status === "fulfilled" ? "ok" : "unreachable",
    ai: checks[1].status === "fulfilled" ? "ok" : "unreachable",
    workflow: checks[2].status === "fulfilled" ? "ok" : "unreachable",
  };

  const allHealthy = Object.values(results).every((s) => s === "ok");

  return c.json({
    status: allHealthy ? "healthy" : "degraded",
    services: results,
  });
});

// Dashboard health endpoint — authenticated, returns extended system status
app.get("/api/health", async (c) => {
  const checks = await Promise.allSettled([
    c.env.NEXUS_STORAGE.fetch("http://nexus-storage/health"),
    c.env.NEXUS_AI.fetch("http://nexus-ai/health"),
    c.env.NEXUS_WORKFLOW.fetch("http://nexus-workflow/health"),
  ]);

  const serviceStatus = {
    storage: checks[0].status === "fulfilled" ? "ok" : "unreachable",
    ai: checks[1].status === "fulfilled" ? "ok" : "unreachable",
    workflow: checks[2].status === "fulfilled" ? "ok" : "unreachable",
  };

  const allHealthy = Object.values(serviceStatus).every((s) => s === "ok");

  // Fetch additional stats if storage is available
  let dbStats: Record<string, unknown> | null = null;
  let aiHealth: unknown = null;

  if (serviceStatus.storage === "ok") {
    try {
      const statsResp = await c.env.NEXUS_STORAGE.fetch(
        "http://nexus-storage/d1/query",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sql: `SELECT
              (SELECT COUNT(*) FROM products) as products,
              (SELECT COUNT(*) FROM workflow_runs) as workflow_runs,
              (SELECT COUNT(*) FROM workflow_runs WHERE status = 'running') as running_workflows,
              (SELECT COUNT(*) FROM workflow_runs WHERE status = 'failed') as failed_workflows,
              (SELECT COUNT(*) FROM analytics) as analytics_events`,
            params: [],
          }),
        }
      );
      const statsJson = (await statsResp.json()) as ApiResponse;
      if (statsJson.success) {
        dbStats = (statsJson.data as { results?: Record<string, unknown>[] })?.results?.[0] ?? null;
      }
    } catch {
      // Stats are best-effort
    }
  }

  if (serviceStatus.ai === "ok") {
    try {
      const aiResp = await c.env.NEXUS_AI.fetch("http://nexus-ai/ai/health");
      const aiJson = (await aiResp.json()) as ApiResponse;
      if (aiJson.success) {
        aiHealth = aiJson.data;
      }
    } catch {
      // AI health is best-effort
    }
  }

  return c.json<ApiResponse>({
    success: true,
    data: {
      status: allHealthy ? "healthy" : "degraded",
      services: serviceStatus,
      database: dbStats,
      aiModels: aiHealth,
      timestamp: new Date().toISOString(),
    },
  });
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
app.route("/api/export", exportRoutes);
app.route("/api/api-keys", apiKeys);
app.route("/api/ai-ceo", aiCeo);

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
