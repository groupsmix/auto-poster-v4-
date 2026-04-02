// ============================================================
// Smart Scheduling Service
// Per-platform optimal posting times, dynamic interval adjustment,
// timezone-aware scheduling
// ============================================================

import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Optimal posting times by platform (hours in UTC) ---
// Based on industry research for digital product platforms

const PLATFORM_OPTIMAL_HOURS: Record<string, number[]> = {
  etsy: [10, 14, 16, 20],          // 10am, 2pm, 4pm, 8pm EST-adjusted
  gumroad: [9, 12, 15, 18],        // Morning + afternoon for creators
  shopify: [10, 13, 17, 20],       // Business hours + evening
  redbubble: [11, 14, 17, 21],     // Afternoon/evening browsing
  amazon_kdp: [8, 12, 16, 20],     // Throughout the day
  payhip: [9, 13, 16, 19],         // Creator-friendly hours
  tiktok_shop: [12, 15, 19, 21],   // Lunch + evening engagement
};

const SOCIAL_OPTIMAL_HOURS: Record<string, number[]> = {
  instagram: [11, 13, 17, 19],     // Lunch + post-work
  tiktok: [7, 12, 19, 22],         // Morning, lunch, evening, late night
  twitter: [8, 12, 17, 21],        // Commute + lunch + post-work
  linkedin: [7, 10, 12, 17],       // Business hours
  facebook: [9, 13, 16, 20],       // Mid-morning + afternoon
  youtube: [12, 15, 17, 20],       // Afternoon + evening
  pinterest: [14, 20, 21, 23],     // Evening browsing peak
};

interface OptimalTimeResult {
  platform: string;
  optimal_hours_utc: number[];
  optimal_hours_local: number[];
  timezone: string;
  best_hour_utc: number;
  best_hour_local: number;
  reasoning: string;
}

/**
 * Get optimal posting times for a platform, adjusted for timezone.
 */
export function getOptimalPostingTimes(
  platform: string,
  timezone: string = "UTC"
): OptimalTimeResult {
  const hours = PLATFORM_OPTIMAL_HOURS[platform] ?? SOCIAL_OPTIMAL_HOURS[platform] ?? [10, 14, 18];

  // Convert UTC hours to local timezone
  let offsetHours = 0;
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const localHour = parseInt(formatter.format(now), 10);
    const utcHour = now.getUTCHours();
    offsetHours = localHour - utcHour;
  } catch {
    // If timezone parsing fails, assume UTC
    offsetHours = 0;
  }

  const localHours = hours.map((h) => ((h + offsetHours) % 24 + 24) % 24);

  return {
    platform,
    optimal_hours_utc: hours,
    optimal_hours_local: localHours,
    timezone,
    best_hour_utc: hours[0],
    best_hour_local: localHours[0],
    reasoning: `Based on ${platform} engagement patterns. Peak activity during ${hours.map((h) => `${h}:00 UTC`).join(", ")}.`,
  };
}

/**
 * Get optimal times for all platforms at once.
 */
export function getAllOptimalTimes(timezone: string = "UTC"): {
  platforms: OptimalTimeResult[];
  social: OptimalTimeResult[];
} {
  const platforms = Object.keys(PLATFORM_OPTIMAL_HOURS).map((p) =>
    getOptimalPostingTimes(p, timezone)
  );
  const social = Object.keys(SOCIAL_OPTIMAL_HOURS).map((p) =>
    getOptimalPostingTimes(p, timezone)
  );
  return { platforms, social };
}

/**
 * Calculate dynamic interval adjustment based on recent performance.
 * If products are performing well, suggest shorter intervals.
 * If products are performing poorly, suggest longer intervals.
 */
export async function calculateDynamicInterval(
  scheduleId: string,
  env: RouterEnv
): Promise<{
  current_interval_hours: number;
  suggested_interval_hours: number;
  adjustment_reason: string;
  recent_success_rate: number;
  recent_avg_score: number;
}> {
  // Get the schedule's current interval
  const schedules = (await storageQuery<Array<{ interval_hours: number }>>(
    env,
    `SELECT interval_hours FROM schedules WHERE id = ?`,
    [scheduleId]
  )) ?? [];

  const currentInterval = schedules[0]?.interval_hours ?? 24;

  // Get recent schedule runs performance
  const runs = (await storageQuery<Array<{
    products_created: number;
    products_approved: number;
    products_failed: number;
    status: string;
  }>>(
    env,
    `SELECT products_created, products_approved, products_failed, status
     FROM schedule_runs
     WHERE schedule_id = ? AND started_at > datetime('now', '-7 days')
     ORDER BY started_at DESC
     LIMIT 10`,
    [scheduleId]
  )) ?? [];

  if (runs.length === 0) {
    return {
      current_interval_hours: currentInterval,
      suggested_interval_hours: currentInterval,
      adjustment_reason: "No recent runs to analyze",
      recent_success_rate: 0,
      recent_avg_score: 0,
    };
  }

  const totalCreated = runs.reduce((sum, r) => sum + (r.products_created ?? 0), 0);
  const totalApproved = runs.reduce((sum, r) => sum + (r.products_approved ?? 0), 0);
  const totalFailed = runs.reduce((sum, r) => sum + (r.products_failed ?? 0), 0);
  const successRate = totalCreated > 0 ? totalApproved / totalCreated : 0;

  // Get average quality score from recent products
  const scores = (await storageQuery<Array<{ avg_score: number }>>(
    env,
    `SELECT AVG(CAST(quality_score AS REAL)) as avg_score
     FROM products
     WHERE created_at > datetime('now', '-7 days')
     AND quality_score IS NOT NULL`,
  )) ?? [];

  const avgScore = scores[0]?.avg_score ?? 0;

  // Dynamic adjustment logic
  let suggestedInterval = currentInterval;
  let reason = "Performance is stable";

  if (successRate >= 0.8 && avgScore >= 8) {
    // Excellent performance — decrease interval (more frequent)
    suggestedInterval = Math.max(4, Math.floor(currentInterval * 0.75));
    reason = "High success rate and quality — increasing frequency";
  } else if (successRate >= 0.6 && avgScore >= 7) {
    // Good performance — slight decrease
    suggestedInterval = Math.max(6, Math.floor(currentInterval * 0.9));
    reason = "Good performance — slightly increasing frequency";
  } else if (successRate < 0.3 || avgScore < 5) {
    // Poor performance — increase interval (less frequent)
    suggestedInterval = Math.min(168, Math.ceil(currentInterval * 1.5));
    reason = "Low success rate or quality — decreasing frequency to improve";
  } else if (totalFailed > totalApproved) {
    // More failures than successes
    suggestedInterval = Math.min(168, Math.ceil(currentInterval * 1.25));
    reason = "High failure rate — reducing frequency";
  }

  return {
    current_interval_hours: currentInterval,
    suggested_interval_hours: suggestedInterval,
    adjustment_reason: reason,
    recent_success_rate: Math.round(successRate * 100),
    recent_avg_score: Math.round(avgScore * 10) / 10,
  };
}

/**
 * Apply a dynamic interval adjustment to a schedule.
 */
export async function applyDynamicInterval(
  scheduleId: string,
  newIntervalHours: number,
  env: RouterEnv
): Promise<void> {
  const nextRunAt = new Date(Date.now() + newIntervalHours * 3600000).toISOString();
  await storageQuery(
    env,
    `UPDATE schedules SET interval_hours = ?, next_run_at = ?, updated_at = datetime('now') WHERE id = ?`,
    [newIntervalHours, nextRunAt, scheduleId]
  );
}
