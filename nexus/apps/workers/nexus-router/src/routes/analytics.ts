import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { PRODUCT_STATUS } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService, errorResponse } from "../helpers";

const analytics = new Hono<{ Bindings: RouterEnv }>();

// GET /api/analytics/overview — total products, AI usage, cache hit rate, cost savings
analytics.get("/overview", async (c) => {
  try {
    const [productCounts, aiUsage, cacheStats] = await Promise.all([
      storageQuery(
        c.env,
        `SELECT
          COUNT(*) as total_products,
                    SUM(CASE WHEN status = '${PRODUCT_STATUS.PUBLISHED}' THEN 1 ELSE 0 END) as published,
                    SUM(CASE WHEN status = '${PRODUCT_STATUS.RUNNING}' THEN 1 ELSE 0 END) as running,
                    SUM(CASE WHEN status = '${PRODUCT_STATUS.PENDING_REVIEW}' THEN 1 ELSE 0 END) as pending_review
        FROM products`
      ),
      storageQuery(
        c.env,
        `SELECT
          SUM(tokens_used) as total_tokens,
          SUM(cost) as total_cost,
          COUNT(*) as total_ai_calls
        FROM analytics WHERE event_type = 'ai_call'`
      ),
      storageQuery(
        c.env,
        `SELECT
          COUNT(*) as total_cache_checks,
          SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cache_hits
        FROM analytics WHERE event_type IN ('ai_call', 'cache_hit')`
      ),
    ]);

    return c.json<ApiResponse>({
      success: true,
      data: {
        products: productCounts,
        ai_usage: aiUsage,
        cache: cacheStats,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/analytics/ai-usage — tokens per provider, cost breakdown
analytics.get("/ai-usage", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT
        ai_model,
        COUNT(*) as call_count,
        SUM(tokens_used) as total_tokens,
        SUM(cost) as total_cost,
        AVG(latency_ms) as avg_latency_ms,
        SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cache_hits
      FROM analytics
      WHERE event_type = 'ai_call'
      GROUP BY ai_model
      ORDER BY call_count DESC`
    );

    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/analytics/health — AI health leaderboard
analytics.get("/health", async (c) => {
  try {
    // Get health data from nexus-ai
    const result = await forwardToService(c.env.NEXUS_AI, "/ai/health");

    // Supplement with DB analytics
    const dbHealth = await storageQuery(
      c.env,
      `SELECT
        ai_model,
        COUNT(*) as total_calls,
        SUM(CASE WHEN event_type = 'error' THEN 1 ELSE 0 END) as total_failures,
        AVG(latency_ms) as avg_latency_ms
      FROM analytics
      WHERE ai_model IS NOT NULL
      GROUP BY ai_model
      ORDER BY total_calls DESC`
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        live_health: result.data,
        historical: dbHealth,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/analytics/cost-by-step — per-step cost aggregation from workflow_steps
analytics.get("/cost-by-step", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT
        ws.step_name,
        COUNT(*) as total_runs,
        SUM(ws.cost) as total_cost,
        AVG(ws.cost) as avg_cost,
        SUM(ws.tokens_used) as total_tokens,
        AVG(ws.latency_ms) as avg_latency_ms
      FROM workflow_steps ws
      WHERE ws.status = 'completed'
      GROUP BY ws.step_name
      ORDER BY total_cost DESC`
    );

    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default analytics;
