import { Hono } from "hono";
import type { ApiResponse, HealthDashboard } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const healthDashboard = new Hono<{ Bindings: RouterEnv }>();

// GET /api/health-dashboard — single page showing all system health metrics
healthDashboard.get("/", async (c) => {
  try {
    const [
      workflowStats,
      publishStats,
      qualityScores,
      qualityTrend,
      topNiches,
      requestCount,
    ] = await Promise.all([
      // Workflow success rate
      storageQuery<Array<{ total: number; failed: number }>>(
        c.env,
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM workflow_runs`
      ),
      // Publish success rate
      storageQuery<Array<{ total: number; failed: number }>>(
        c.env,
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM publish_queue`
      ),
      // Average quality score
      storageQuery<Array<{ avg_score: number }>>(
        c.env,
        `SELECT AVG(ai_score) as avg_score FROM reviews WHERE ai_score IS NOT NULL`
      ),
      // Quality score trend (last 30 days)
      storageQuery<Array<{ date: string; score: number }>>(
        c.env,
        `SELECT
          date(reviewed_at) as date,
          ROUND(AVG(ai_score), 1) as score
        FROM reviews
        WHERE reviewed_at > date('now', '-30 days') AND ai_score IS NOT NULL
        GROUP BY date(reviewed_at)
        ORDER BY date ASC`
      ),
      // Top performing niches
      storageQuery<Array<{ niche: string; products: number; avg_score: number; revenue: number }>>(
        c.env,
        `SELECT
          p.niche,
          COUNT(DISTINCT p.id) as products,
          ROUND(AVG(r.ai_score), 1) as avg_score,
          COALESCE(SUM(rev.revenue), 0) as revenue
        FROM products p
        LEFT JOIN reviews r ON r.product_id = p.id
        LEFT JOIN revenue_records rev ON rev.product_id = p.id
        WHERE p.niche IS NOT NULL AND p.niche != ''
        GROUP BY p.niche
        ORDER BY products DESC
        LIMIT 10`
      ),
      // Total analytics events (proxy for API usage)
      storageQuery<Array<{ total: number }>>(
        c.env,
        `SELECT COUNT(*) as total FROM analytics WHERE created_at > date('now', '-30 days')`
      ),
    ]);

    const wfTotal = workflowStats[0]?.total ?? 0;
    const wfFailed = workflowStats[0]?.failed ?? 0;
    const pubTotal = publishStats[0]?.total ?? 0;
    const pubFailed = publishStats[0]?.failed ?? 0;
    const reqTotal = requestCount[0]?.total ?? 0;

    const dashboard: HealthDashboard = {
      api_credits: {
        workers_requests: { used: reqTotal, limit: 10_000_000 },
        kv_reads: { used: Math.round(reqTotal * 3), limit: 10_000_000 },
        d1_reads: { used: Math.round(reqTotal * 2), limit: 25_000_000_000 },
        r2_storage_gb: { used: 0, limit: 10 },
      },
      workflow_success_rate: wfTotal > 0 ? Math.round(((wfTotal - wfFailed) / wfTotal) * 100) : 100,
      workflow_total: wfTotal,
      workflow_failed: wfFailed,
      publish_success_rate: pubTotal > 0 ? Math.round(((pubTotal - pubFailed) / pubTotal) * 100) : 100,
      publish_total: pubTotal,
      publish_failed: pubFailed,
      avg_quality_score: Math.round((qualityScores[0]?.avg_score ?? 0) * 10) / 10,
      quality_score_trend: qualityTrend,
      top_niches: topNiches,
    };

    return c.json<ApiResponse>({ success: true, data: dashboard });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default healthDashboard;
