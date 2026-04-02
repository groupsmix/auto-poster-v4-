// ============================================================
// Sales Feedback Loop → AI Learning Service
// Feeds sales data back to CEO AI for prompt optimization,
// auto-adjusts niche investment based on ROI,
// calibrates quality scoring against actual sales performance
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService } from "../helpers";

// --- Types ---

interface TopSellerData {
  product_id: string;
  niche: string;
  category_name: string;
  domain_name: string;
  quality_score: number;
  total_revenue: number;
  total_sales: number;
  platforms: string;
}

interface NichePerformance {
  niche: string;
  total_revenue: number;
  total_sales: number;
  avg_quality_score: number;
  product_count: number;
  roi_score: number;
}

interface FeedbackResult {
  top_sellers_analyzed: number;
  niches_analyzed: number;
  prompt_updates: number;
  niche_adjustments: Array<{
    niche: string;
    action: string;
    reason: string;
  }>;
  quality_calibration: {
    correlation: number;
    avg_score_top_sellers: number;
    avg_score_low_sellers: number;
    recommendation: string;
  };
}

/**
 * Run the full sales feedback loop:
 * 1. Analyze top-selling products
 * 2. Feed patterns to AI for prompt optimization
 * 3. Auto-adjust niche investment based on ROI
 * 4. Calibrate quality scoring
 */
export async function runSalesFeedbackLoop(env: RouterEnv): Promise<FeedbackResult> {
  // Step 1: Get top-selling products with their details
  const topSellers = (await storageQuery<TopSellerData[]>(
    env,
    `SELECT
      p.id as product_id,
      p.niche,
      c.name as category_name,
      d.name as domain_name,
      p.quality_score,
      COALESCE(SUM(r.revenue), 0) as total_revenue,
      COALESCE(SUM(r.quantity), 0) as total_sales,
      p.platforms
    FROM products p
    LEFT JOIN revenue_records r ON r.product_id = p.id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN domains d ON d.id = p.domain_id
    WHERE p.status IN ('published', 'approved')
    AND p.created_at > datetime('now', '-90 days')
    GROUP BY p.id
    HAVING total_revenue > 0
    ORDER BY total_revenue DESC
    LIMIT 20`
  )) ?? [];

  // Step 2: Get low-performing products for comparison
  const lowSellers = (await storageQuery<Array<{
    quality_score: number;
    total_revenue: number;
  }>>(
    env,
    `SELECT
      p.quality_score,
      COALESCE(SUM(r.revenue), 0) as total_revenue
    FROM products p
    LEFT JOIN revenue_records r ON r.product_id = p.id
    WHERE p.status IN ('published', 'approved')
    AND p.created_at > datetime('now', '-90 days')
    GROUP BY p.id
    HAVING total_revenue = 0
    ORDER BY p.created_at DESC
    LIMIT 20`
  )) ?? [];

  // Step 3: Analyze niche performance
  const nichePerformance = (await storageQuery<NichePerformance[]>(
    env,
    `SELECT
      p.niche,
      COALESCE(SUM(r.revenue), 0) as total_revenue,
      COALESCE(SUM(r.quantity), 0) as total_sales,
      AVG(CAST(p.quality_score AS REAL)) as avg_quality_score,
      COUNT(DISTINCT p.id) as product_count,
      CASE
        WHEN COUNT(DISTINCT p.id) > 0
        THEN COALESCE(SUM(r.revenue), 0) / COUNT(DISTINCT p.id)
        ELSE 0
      END as roi_score
    FROM products p
    LEFT JOIN revenue_records r ON r.product_id = p.id
    WHERE p.niche IS NOT NULL
    AND p.created_at > datetime('now', '-90 days')
    GROUP BY p.niche
    ORDER BY roi_score DESC`
  )) ?? [];

  // Step 4: Feed top-seller patterns to AI for prompt learning
  let promptUpdates = 0;
  if (topSellers.length >= 3) {
    try {
      const topSellerSummary = topSellers.slice(0, 10).map((s) => ({
        niche: s.niche,
        category: s.category_name,
        domain: s.domain_name,
        quality_score: s.quality_score,
        revenue: s.total_revenue,
        sales: s.total_sales,
      }));

      // Store learning data in KV for the CEO AI to use
      const learningData = {
        timestamp: now(),
        top_sellers: topSellerSummary,
        top_niches: nichePerformance.slice(0, 5).map((n) => ({
          niche: n.niche,
          revenue: n.total_revenue,
          roi_score: n.roi_score,
        })),
        patterns: {
          avg_score_top_sellers: topSellers.reduce((s, t) => s + (t.quality_score ?? 0), 0) / topSellers.length,
          most_profitable_niche: nichePerformance[0]?.niche ?? "unknown",
          top_categories: [...new Set(topSellers.map((s) => s.category_name))].slice(0, 5),
        },
      };

      // Store in KV for AI to reference
      await env.NEXUS_STORAGE.fetch("http://nexus-storage/kv/sales:learning:latest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "sales:learning:latest",
          value: JSON.stringify(learningData),
          metadata: { updated_at: now() },
        }),
      });

      // Also store historical snapshot
      const snapshotKey = `sales:learning:${new Date().toISOString().split("T")[0]}`;
      await env.NEXUS_STORAGE.fetch(`http://nexus-storage/kv/${snapshotKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: snapshotKey,
          value: JSON.stringify(learningData),
          metadata: { updated_at: now() },
        }),
      });

      promptUpdates = 1;
    } catch (err) {
      console.error("[SALES-FEEDBACK] Failed to update AI learning data:", err instanceof Error ? err.message : String(err));
    }
  }

  // Step 5: Auto-adjust niche investment recommendations
  const nicheAdjustments: Array<{ niche: string; action: string; reason: string }> = [];
  for (const niche of nichePerformance) {
    if (niche.roi_score > 50 && niche.total_sales > 5) {
      nicheAdjustments.push({
        niche: niche.niche,
        action: "increase",
        reason: `High ROI ($${niche.roi_score.toFixed(2)}/product) with ${niche.total_sales} sales`,
      });
    } else if (niche.product_count > 5 && niche.total_revenue === 0) {
      nicheAdjustments.push({
        niche: niche.niche,
        action: "decrease",
        reason: `${niche.product_count} products created but $0 revenue`,
      });
    }
  }

  // Store niche adjustments in KV
  if (nicheAdjustments.length > 0) {
    await env.NEXUS_STORAGE.fetch("http://nexus-storage/kv/sales:niche-adjustments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "sales:niche-adjustments",
        value: JSON.stringify({ adjustments: nicheAdjustments, updated_at: now() }),
        metadata: { updated_at: now() },
      }),
    });
  }

  // Step 6: Quality calibration — compare AI scores vs actual sales
  const avgScoreTopSellers = topSellers.length > 0
    ? topSellers.reduce((s, t) => s + (t.quality_score ?? 0), 0) / topSellers.length
    : 0;
  const avgScoreLowSellers = lowSellers.length > 0
    ? lowSellers.reduce((s, t) => s + (t.quality_score ?? 0), 0) / lowSellers.length
    : 0;

  // Simple correlation check
  const scoreDiff = avgScoreTopSellers - avgScoreLowSellers;
  let correlation = 0;
  let recommendation = "Not enough data for calibration";

  if (topSellers.length >= 5 && lowSellers.length >= 5) {
    // If top sellers have higher scores, scoring is well-calibrated
    correlation = scoreDiff > 0 ? Math.min(1, scoreDiff / 3) : Math.max(-1, scoreDiff / 3);
    if (correlation > 0.3) {
      recommendation = "Quality scoring is well-calibrated — higher scores correlate with higher sales";
    } else if (correlation < -0.1) {
      recommendation = "Quality scoring needs recalibration — low-scored products are outselling high-scored ones";
    } else {
      recommendation = "Quality scoring has weak correlation with sales — consider adjusting scoring criteria";
    }
  }

  return {
    top_sellers_analyzed: topSellers.length,
    niches_analyzed: nichePerformance.length,
    prompt_updates: promptUpdates,
    niche_adjustments: nicheAdjustments,
    quality_calibration: {
      correlation: Math.round(correlation * 100) / 100,
      avg_score_top_sellers: Math.round(avgScoreTopSellers * 10) / 10,
      avg_score_low_sellers: Math.round(avgScoreLowSellers * 10) / 10,
      recommendation,
    },
  };
}

/**
 * Get current AI learning data (what the AI has learned from sales).
 */
export async function getSalesLearningData(env: RouterEnv): Promise<unknown> {
  try {
    const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/kv/sales:learning:latest");
    const json = (await resp.json()) as { success: boolean; data?: unknown };
    if (json.success && json.data) {
      const value = (json.data as { value?: string }).value;
      return value ? JSON.parse(value) : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get niche adjustment recommendations.
 */
export async function getNicheAdjustments(env: RouterEnv): Promise<unknown> {
  try {
    const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/kv/sales:niche-adjustments");
    const json = (await resp.json()) as { success: boolean; data?: unknown };
    if (json.success && json.data) {
      const value = (json.data as { value?: string }).value;
      return value ? JSON.parse(value) : null;
    }
    return null;
  } catch {
    return null;
  }
}
