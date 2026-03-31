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
import schedulesRoutes from "./routes/schedules";
import campaignsRoutes from "./routes/campaigns";
import revenueRoutes from "./routes/revenue";
import roiRoutes from "./routes/roi";
import recyclerRoutes from "./routes/recycler";
import localizationRoutes from "./routes/localization";
import chatbot from "./routes/chatbot";
import projectBuilder from "./routes/project-builder";
import { executeCampaignBatch } from "./services/campaign-service";

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
    c.env.NEXUS_VARIATION.fetch("http://nexus-variation/health"),
  ]);

  const results = {
    storage: checks[0].status === "fulfilled" ? "ok" : "unreachable",
    ai: checks[1].status === "fulfilled" ? "ok" : "unreachable",
    workflow: checks[2].status === "fulfilled" ? "ok" : "unreachable",
    variation: checks[3].status === "fulfilled" ? "ok" : "unreachable",
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
    c.env.NEXUS_VARIATION.fetch("http://nexus-variation/health"),
  ]);

  const serviceStatus = {
    storage: checks[0].status === "fulfilled" ? "ok" : "unreachable",
    ai: checks[1].status === "fulfilled" ? "ok" : "unreachable",
    workflow: checks[2].status === "fulfilled" ? "ok" : "unreachable",
    variation: checks[3].status === "fulfilled" ? "ok" : "unreachable",
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
app.route("/api/schedules", schedulesRoutes);
app.route("/api/campaigns", campaignsRoutes);
app.route("/api/revenue", revenueRoutes);
app.route("/api/roi", roiRoutes);
app.route("/api/recycler", recyclerRoutes);
app.route("/api/localization", localizationRoutes);
app.route("/api/chatbot", chatbot);
app.route("/api/project-builder", projectBuilder);

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

// ============================================================
// Scheduled handler — cron trigger for automatic schedule execution
// ============================================================

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: RouterEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log("[CRON] Scheduled tick triggered");
    try {
      // Call the internal schedules tick endpoint
      const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `SELECT id, name, domain_id, category_id, niche_keywords, products_per_run,
                       interval_hours, platforms, social_channels, language,
                       auto_approve_threshold, auto_revise_min_score, max_auto_revisions,
                       last_run_at, next_run_at
                FROM schedules
                WHERE active = 1 AND next_run_at <= ?`,
          params: [new Date().toISOString()],
        }),
      });
      const json = (await resp.json()) as ApiResponse;
      if (!json.success || !json.data) {
        console.error("[CRON] Failed to fetch due schedules:", json.error);
        return;
      }

      const schedules = ((json.data as { results?: unknown[] })?.results ?? []) as Array<{
        id: string;
        domain_id: string;
        products_per_run: number;
        interval_hours: number;
        niche_keywords?: string;
        platforms?: string;
        social_channels?: string;
        language?: string;
        auto_approve_threshold?: number;
        auto_revise_min_score?: number;
        max_auto_revisions?: number;
      }>;

      console.log(`[CRON] Found ${schedules.length} due schedule(s)`);

      for (const schedule of schedules) {
        ctx.waitUntil(
          (async () => {
            try {
              // Trigger workflow for each product in the schedule
              const keywords = schedule.niche_keywords
                ? JSON.parse(schedule.niche_keywords) as string[]
                : [];
              const keyword = keywords[Math.floor(Math.random() * keywords.length)] ?? "general";

              for (let i = 0; i < (schedule.products_per_run ?? 1); i++) {
                await env.NEXUS_WORKFLOW.fetch("http://nexus-workflow/workflow/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    domainId: schedule.domain_id,
                    keyword: `${keyword} #${i + 1}`,
                    platforms: schedule.platforms ? JSON.parse(schedule.platforms) : undefined,
                    socialChannels: schedule.social_channels ? JSON.parse(schedule.social_channels) : undefined,
                    language: schedule.language,
                    autoApproveThreshold: schedule.auto_approve_threshold,
                  }),
                });
              }

              // Update schedule timing
              const nextRun = new Date(
                Date.now() + (schedule.interval_hours ?? 24) * 3600 * 1000
              ).toISOString();
              await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sql: `UPDATE schedules SET last_run_at = ?, next_run_at = ?, total_runs = total_runs + 1 WHERE id = ?`,
                  params: [new Date().toISOString(), nextRun, schedule.id],
                }),
              });

              console.log(`[CRON] Schedule ${schedule.id} executed successfully`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[CRON] Schedule ${schedule.id} failed: ${msg}`);
            }
          })()
        );
      }

      // --- Campaign execution: run active campaigns' daily batches ---
      ctx.waitUntil(
        (async () => {
          try {
            const campaignResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sql: `SELECT id FROM campaigns WHERE status = 'active'`,
                params: [],
              }),
            });
            const campaignJson = (await campaignResp.json()) as ApiResponse;
            if (!campaignJson.success || !campaignJson.data) {
              console.error("[CRON] Failed to fetch active campaigns:", campaignJson.error);
              return;
            }

            const campaigns = ((campaignJson.data as { results?: unknown[] })?.results ?? []) as Array<{ id: string }>;
            console.log(`[CRON] Found ${campaigns.length} active campaign(s)`);

            for (const campaign of campaigns) {
              try {
                const result = await executeCampaignBatch(campaign.id, env);
                console.log(`[CRON] Campaign ${campaign.id}: queued ${result.products_queued} products (${result.status})`);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[CRON] Campaign ${campaign.id} failed: ${msg}`);
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[CRON] Campaign execution failed: ${msg}`);
          }
        })()
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CRON] Scheduled handler failed: ${msg}`);
    }
  },
};
