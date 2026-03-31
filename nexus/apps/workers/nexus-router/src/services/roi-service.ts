// ============================================================
// ROI Optimizer / Niche Killer Service
// Tracks cost per product, revenue per product, calculates ROI per niche.
// Generates weekly reports identifying winners and losers.
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Types ---

interface CostInput {
  domain_id: string;
  category_id?: string;
  niche?: string;
  cost_type?: string;
  amount: number;
  currency?: string;
  description?: string;
  product_id?: string;
}

interface ROISnapshotInput {
  domain_id: string;
  category_id?: string;
  niche?: string;
  period?: string;
  period_start: string;
  period_end: string;
}

// --- Helper: extract rows from storageQuery result ---

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const obj = result as { results?: T[] } | undefined;
  return obj?.results ?? [];
}

// --- Niche Costs CRUD ---

export async function addNicheCost(
  input: CostInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const id = generateId();

  await storageQuery(
    env,
    `INSERT INTO niche_costs (id, domain_id, category_id, niche, cost_type, amount, currency, description, product_id, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.domain_id,
      input.category_id ?? null,
      input.niche ?? null,
      input.cost_type ?? "ai_api",
      input.amount,
      input.currency ?? "USD",
      input.description ?? null,
      input.product_id ?? null,
      now(),
    ]
  );

  return { id };
}

export async function listNicheCosts(
  env: RouterEnv,
  options?: { domain_id?: string; niche?: string; limit?: number }
): Promise<unknown> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.domain_id) {
    conditions.push("domain_id = ?");
    params.push(options.domain_id);
  }
  if (options?.niche) {
    conditions.push("niche = ?");
    params.push(options.niche);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 100;

  return storageQuery(
    env,
    `SELECT * FROM niche_costs ${whereClause} ORDER BY recorded_at DESC LIMIT ?`,
    [...params, limit]
  );
}

export async function deleteNicheCost(id: string, env: RouterEnv): Promise<void> {
  await storageQuery(env, "DELETE FROM niche_costs WHERE id = ?", [id]);
}

// --- ROI Snapshot Generation ---

export async function generateROISnapshot(
  input: ROISnapshotInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const id = generateId();
  const period = input.period ?? "weekly";

  // Calculate total cost for this niche/domain in the period
  const costConditions: string[] = ["recorded_at >= ?", "recorded_at <= ?"];
  const costParams: unknown[] = [input.period_start, input.period_end];

  if (input.domain_id) {
    costConditions.push("domain_id = ?");
    costParams.push(input.domain_id);
  }
  if (input.niche) {
    costConditions.push("niche = ?");
    costParams.push(input.niche);
  }

  const costResult = await storageQuery(
    env,
    `SELECT COALESCE(SUM(amount), 0) as total_cost, COUNT(DISTINCT product_id) as products_count
     FROM niche_costs WHERE ${costConditions.join(" AND ")}`,
    costParams
  );
  const costRows = extractRows<{ total_cost: number; products_count: number }>(costResult);
  const totalCost = costRows[0]?.total_cost ?? 0;
  const productsCount = costRows[0]?.products_count ?? 0;

  // Calculate total revenue for this niche/domain in the period
  const revenueConditions: string[] = ["rr.order_date >= ?", "rr.order_date <= ?"];
  const revenueParams: unknown[] = [input.period_start, input.period_end];

  let revenueJoin = "";
  if (input.domain_id) {
    revenueJoin = " INNER JOIN products p ON p.id = rr.product_id";
    revenueConditions.push("p.domain_id = ?");
    revenueParams.push(input.domain_id);
  }
  if (input.niche) {
    if (!revenueJoin) revenueJoin = " INNER JOIN products p ON p.id = rr.product_id";
    revenueConditions.push("p.niche LIKE ?");
    revenueParams.push(`%${input.niche}%`);
  }

  const revenueResult = await storageQuery(
    env,
    `SELECT COALESCE(SUM(rr.revenue), 0) as total_revenue, COUNT(DISTINCT rr.external_order_id) as orders_count
     FROM revenue_records rr${revenueJoin}
     WHERE ${revenueConditions.join(" AND ")}`,
    revenueParams
  );
  const revenueRows = extractRows<{ total_revenue: number; orders_count: number }>(revenueResult);
  const totalRevenue = revenueRows[0]?.total_revenue ?? 0;
  const ordersCount = revenueRows[0]?.orders_count ?? 0;

  const netProfit = totalRevenue - totalCost;
  const roiMultiplier = totalCost > 0 ? Math.round((totalRevenue / totalCost) * 100) / 100 : 0;

  // Generate recommendation
  let recommendation: string | null = null;
  if (roiMultiplier >= 5) {
    recommendation = `High ROI (${roiMultiplier}x). Recommend: create more products in this niche.`;
  } else if (roiMultiplier >= 1) {
    recommendation = `Positive ROI (${roiMultiplier}x). Keep producing, consider variations.`;
  } else if (totalCost > 0) {
    recommendation = `Low ROI (${roiMultiplier}x). Consider reducing investment or pivoting.`;
  }

  await storageQuery(
    env,
    `INSERT INTO roi_snapshots (id, domain_id, category_id, niche, period, period_start, period_end,
       total_revenue, total_cost, net_profit, roi_multiplier, products_count, orders_count, recommendation, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.domain_id,
      input.category_id ?? null,
      input.niche ?? null,
      period,
      input.period_start,
      input.period_end,
      totalRevenue,
      totalCost,
      netProfit,
      roiMultiplier,
      productsCount,
      ordersCount,
      recommendation,
      now(),
    ]
  );

  return { id };
}

// --- ROI Report Generation ---

export async function generateROIReport(
  env: RouterEnv,
  periodStart: string,
  periodEnd: string,
  reportType: string = "weekly"
): Promise<{ id: string }> {
  const id = generateId();

  // Get ROI snapshots for this period
  const snapshotsResult = await storageQuery(
    env,
    `SELECT * FROM roi_snapshots
     WHERE period_start >= ? AND period_end <= ?
     ORDER BY roi_multiplier DESC`,
    [periodStart, periodEnd]
  );
  const snapshots = extractRows<{
    niche: string;
    domain_id: string;
    category_id: string;
    total_revenue: number;
    total_cost: number;
    roi_multiplier: number;
    products_count: number;
    orders_count: number;
  }>(snapshotsResult);

  // Separate winners (ROI > 2x) and losers (ROI < 1x)
  const winners = snapshots
    .filter((s) => s.roi_multiplier >= 2)
    .map((s) => ({
      niche: s.niche ?? "Unknown",
      domain_id: s.domain_id,
      category_id: s.category_id,
      revenue: s.total_revenue,
      cost: s.total_cost,
      roi_multiplier: s.roi_multiplier,
      products_count: s.products_count,
      orders_count: s.orders_count,
    }));

  const losers = snapshots
    .filter((s) => s.roi_multiplier < 1 && s.total_cost > 0)
    .map((s) => ({
      niche: s.niche ?? "Unknown",
      domain_id: s.domain_id,
      category_id: s.category_id,
      revenue: s.total_revenue,
      cost: s.total_cost,
      roi_multiplier: s.roi_multiplier,
      products_count: s.products_count,
      orders_count: s.orders_count,
    }));

  // Generate recommendations
  const recommendations: string[] = [];
  for (const w of winners.slice(0, 3)) {
    recommendations.push(
      `${w.niche} ROI is ${w.roi_multiplier}x. Recommend: create ${Math.min(50, w.products_count * 5)} more products.`
    );
  }
  for (const l of losers.slice(0, 3)) {
    recommendations.push(
      `${l.niche} ROI is ${l.roi_multiplier}x. Recommend: stop investing, redirect budget to winners.`
    );
  }

  const totalRevenue = snapshots.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalCost = snapshots.reduce((sum, s) => sum + s.total_cost, 0);
  const overallRoi = totalCost > 0 ? Math.round((totalRevenue / totalCost) * 100) / 100 : 0;

  await storageQuery(
    env,
    `INSERT INTO roi_reports (id, report_type, period_start, period_end, winners, losers,
       recommendations, total_revenue, total_cost, overall_roi, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      reportType,
      periodStart,
      periodEnd,
      JSON.stringify(winners),
      JSON.stringify(losers),
      JSON.stringify(recommendations),
      totalRevenue,
      totalCost,
      overallRoi,
      now(),
    ]
  );

  return { id };
}

// --- ROI Dashboard ---

export async function getROIDashboard(
  env: RouterEnv,
  options?: { period?: string; domain_id?: string }
): Promise<Record<string, unknown>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.period) {
    conditions.push("period = ?");
    params.push(options.period);
  }
  if (options?.domain_id) {
    conditions.push("domain_id = ?");
    params.push(options.domain_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get latest snapshots
  const snapshotsResult = await storageQuery(
    env,
    `SELECT * FROM roi_snapshots ${whereClause} ORDER BY created_at DESC LIMIT 50`,
    params
  );
  const snapshots = extractRows<Record<string, unknown>>(snapshotsResult);

  // Get latest report
  const reportResult = await storageQuery(
    env,
    "SELECT * FROM roi_reports ORDER BY created_at DESC LIMIT 1",
    []
  );
  const reports = extractRows<Record<string, unknown>>(reportResult);
  const latestReport = reports[0] ?? null;

  // Parse JSON fields in the report
  if (latestReport) {
    if (typeof latestReport.winners === "string") {
      latestReport.winners = JSON.parse(latestReport.winners as string);
    }
    if (typeof latestReport.losers === "string") {
      latestReport.losers = JSON.parse(latestReport.losers as string);
    }
    if (typeof latestReport.recommendations === "string") {
      latestReport.recommendations = JSON.parse(latestReport.recommendations as string);
    }
  }

  // Top niches (highest ROI)
  const topNichesResult = await storageQuery(
    env,
    `SELECT niche, domain_id, category_id,
       SUM(total_revenue) as revenue, SUM(total_cost) as cost,
       CASE WHEN SUM(total_cost) > 0 THEN ROUND(SUM(total_revenue) / SUM(total_cost), 2) ELSE 0 END as roi_multiplier,
       SUM(products_count) as products_count, SUM(orders_count) as orders_count
     FROM roi_snapshots
     GROUP BY niche, domain_id
     HAVING revenue > 0
     ORDER BY roi_multiplier DESC
     LIMIT 10`,
    []
  );
  const topNiches = extractRows<Record<string, unknown>>(topNichesResult);

  // Worst niches (lowest ROI with cost > 0)
  const worstNichesResult = await storageQuery(
    env,
    `SELECT niche, domain_id, category_id,
       SUM(total_revenue) as revenue, SUM(total_cost) as cost,
       CASE WHEN SUM(total_cost) > 0 THEN ROUND(SUM(total_revenue) / SUM(total_cost), 2) ELSE 0 END as roi_multiplier,
       SUM(products_count) as products_count, SUM(orders_count) as orders_count
     FROM roi_snapshots
     GROUP BY niche, domain_id
     HAVING cost > 0
     ORDER BY roi_multiplier ASC
     LIMIT 10`,
    []
  );
  const worstNiches = extractRows<Record<string, unknown>>(worstNichesResult);

  // Totals
  const totalRevenue = snapshots.reduce((sum, s) => sum + (Number(s.total_revenue) || 0), 0);
  const totalCost = snapshots.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0);
  const overallRoi = totalCost > 0 ? Math.round((totalRevenue / totalCost) * 100) / 100 : 0;

  return {
    snapshots,
    latest_report: latestReport,
    top_niches: topNiches,
    worst_niches: worstNiches,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    overall_roi: overallRoi,
  };
}

// --- List Reports ---

export async function listROIReports(
  env: RouterEnv,
  limit: number = 20
): Promise<unknown> {
  const result = await storageQuery(
    env,
    "SELECT * FROM roi_reports ORDER BY created_at DESC LIMIT ?",
    [limit]
  );
  const reports = extractRows<Record<string, unknown>>(result);

  // Parse JSON fields
  for (const report of reports) {
    if (typeof report.winners === "string") {
      report.winners = JSON.parse(report.winners as string);
    }
    if (typeof report.losers === "string") {
      report.losers = JSON.parse(report.losers as string);
    }
    if (typeof report.recommendations === "string") {
      report.recommendations = JSON.parse(report.recommendations as string);
    }
  }

  return reports;
}
