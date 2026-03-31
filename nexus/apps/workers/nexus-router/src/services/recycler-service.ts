// ============================================================
// Smart Product Recycler Service
// Takes a top-selling product and generates variations:
// - Same niche, different angle
// - Bundle products together
// - Seasonal versions
// - Regional versions
// Each variation goes through the full 9-step pipeline.
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Types ---

interface RecyclerJobInput {
  source_product_id: string;
  strategy?: string;
  variations_requested?: number;
  config?: Record<string, unknown>;
}

interface VariationInput {
  job_id: string;
  source_product_id: string;
  variation_type: string;
  variation_label?: string;
  metadata?: Record<string, unknown>;
}

// --- Helper ---

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const obj = result as { results?: T[] } | undefined;
  return obj?.results ?? [];
}

// --- Recycler Jobs CRUD ---

export async function createRecyclerJob(
  input: RecyclerJobInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const id = generateId();

  await storageQuery(
    env,
    `INSERT INTO recycler_jobs (id, source_product_id, strategy, status, variations_requested,
       variations_created, variations_approved, config, created_at)
     VALUES (?, ?, ?, 'pending', ?, 0, 0, ?, ?)`,
    [
      id,
      input.source_product_id,
      input.strategy ?? "all",
      input.variations_requested ?? 10,
      input.config ? JSON.stringify(input.config) : null,
      now(),
    ]
  );

  return { id };
}

export async function getRecyclerJob(id: string, env: RouterEnv): Promise<unknown> {
  const result = await storageQuery(
    env,
    `SELECT rj.*, p.name as source_product_name
     FROM recycler_jobs rj
     LEFT JOIN products p ON p.id = rj.source_product_id
     WHERE rj.id = ?`,
    [id]
  );
  const rows = extractRows<Record<string, unknown>>(result);
  const job = rows[0] ?? null;

  if (job) {
    if (typeof job.config === "string") job.config = JSON.parse(job.config as string);
    if (typeof job.analysis === "string") job.analysis = JSON.parse(job.analysis as string);
  }

  return job;
}

export async function listRecyclerJobs(
  env: RouterEnv,
  options?: { status?: string; limit?: number }
): Promise<unknown> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.status) {
    conditions.push("rj.status = ?");
    params.push(options.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 50;

  const result = await storageQuery(
    env,
    `SELECT rj.*, p.name as source_product_name
     FROM recycler_jobs rj
     LEFT JOIN products p ON p.id = rj.source_product_id
     ${whereClause}
     ORDER BY rj.created_at DESC
     LIMIT ?`,
    [...params, limit]
  );
  const jobs = extractRows<Record<string, unknown>>(result);

  for (const job of jobs) {
    if (typeof job.config === "string") job.config = JSON.parse(job.config as string);
    if (typeof job.analysis === "string") job.analysis = JSON.parse(job.analysis as string);
  }

  return jobs;
}

export async function deleteRecyclerJob(id: string, env: RouterEnv): Promise<void> {
  await storageQuery(env, "DELETE FROM recycler_jobs WHERE id = ?", [id]);
}

// --- Analyze Product (Why it sells) ---

export async function analyzeProduct(
  productId: string,
  env: RouterEnv
): Promise<Record<string, unknown>> {
  // Get product details
  const productResult = await storageQuery(
    env,
    `SELECT p.*, d.name as domain_name, c.name as category_name
     FROM products p
     LEFT JOIN domains d ON d.id = p.domain_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [productId]
  );
  const products = extractRows<Record<string, unknown>>(productResult);
  const product = products[0];
  if (!product) throw new Error("Product not found");

  // Get revenue data
  const revenueResult = await storageQuery(
    env,
    `SELECT COALESCE(SUM(revenue), 0) as total_revenue,
       COUNT(*) as total_orders,
       COALESCE(SUM(quantity), 0) as total_quantity
     FROM revenue_records WHERE product_id = ?`,
    [productId]
  );
  const revenueRows = extractRows<{ total_revenue: number; total_orders: number; total_quantity: number }>(revenueResult);

  // Get platform variants for keyword analysis
  const variantsResult = await storageQuery(
    env,
    "SELECT title, tags, price FROM platform_variants WHERE product_id = ?",
    [productId]
  );
  const variants = extractRows<{ title: string; tags: string | null; price: number }>(variantsResult);

  // Build analysis from available data
  const tags: string[] = [];
  for (const v of variants) {
    if (v.tags) {
      try {
        const parsed = typeof v.tags === "string" ? JSON.parse(v.tags) : v.tags;
        if (Array.isArray(parsed)) tags.push(...parsed);
      } catch {
        // skip invalid tags
      }
    }
  }

  const analysis = {
    product_name: product.name,
    domain: product.domain_name,
    category: product.category_name,
    niche: product.niche,
    revenue: revenueRows[0]?.total_revenue ?? 0,
    orders: revenueRows[0]?.total_orders ?? 0,
    why_it_sells: [
      product.niche ? `Strong niche positioning in "${product.niche}"` : "General market appeal",
      variants.length > 0 ? `Listed on ${variants.length} platform(s)` : "Not yet listed",
      revenueRows[0]?.total_orders > 5 ? "Proven sales velocity" : "Early stage",
    ],
    keywords: [...new Set(tags)].slice(0, 20),
    positioning: product.niche ?? product.category_name ?? "General",
    price_point: variants[0]?.price ? `$${variants[0].price}` : "Not set",
    target_audience: product.domain_name ?? "General audience",
    strengths: [
      "Existing content pipeline",
      "Proven niche demand",
      variants.length > 0 ? "Multi-platform presence" : "Ready for platform expansion",
    ],
  };

  return analysis;
}

// --- Generate Variations ---

export async function generateVariations(
  jobId: string,
  env: RouterEnv
): Promise<{ variations: Array<{ id: string; type: string; label: string }> }> {
  // Get job details
  const jobResult = await storageQuery(
    env,
    `SELECT rj.*, p.name as source_name, p.niche, p.domain_id, p.category_id, p.language
     FROM recycler_jobs rj
     LEFT JOIN products p ON p.id = rj.source_product_id
     WHERE rj.id = ?`,
    [jobId]
  );
  const jobs = extractRows<Record<string, unknown>>(jobResult);
  const job = jobs[0];
  if (!job) throw new Error("Recycler job not found");

  // Mark job as running
  await storageQuery(env, "UPDATE recycler_jobs SET status = 'running' WHERE id = ?", [jobId]);

  const strategy = (job.strategy as string) ?? "all";
  const sourceName = (job.source_name as string) ?? "Product";
  const niche = (job.niche as string) ?? "";
  const requested = (job.variations_requested as number) ?? 10;

  // Generate variation ideas based on strategy
  const variationIdeas: Array<{ type: string; label: string }> = [];

  if (strategy === "angle" || strategy === "all") {
    variationIdeas.push(
      { type: "angle", label: `${sourceName} Budget Planner` },
      { type: "angle", label: `${sourceName} Inspection Guide` },
      { type: "angle", label: `${sourceName} Checklist Pro` },
    );
  }

  if (strategy === "bundle" || strategy === "all") {
    variationIdeas.push(
      { type: "bundle", label: `${niche || sourceName} Starter Kit` },
      { type: "bundle", label: `${niche || sourceName} Complete Bundle` },
    );
  }

  if (strategy === "seasonal" || strategy === "all") {
    variationIdeas.push(
      { type: "seasonal", label: `Summer ${sourceName}` },
      { type: "seasonal", label: `Holiday ${sourceName} Planning` },
    );
  }

  if (strategy === "regional" || strategy === "all") {
    variationIdeas.push(
      { type: "regional", label: `${sourceName} — US Edition` },
      { type: "regional", label: `${sourceName} — UK Edition` },
      { type: "regional", label: `${sourceName} — Dubai Edition` },
    );
  }

  // Limit to requested count
  const selectedVariations = variationIdeas.slice(0, requested);

  // Create variation records
  const created: Array<{ id: string; type: string; label: string }> = [];

  for (const v of selectedVariations) {
    const variationId = generateId();
    await storageQuery(
      env,
      `INSERT INTO recycler_variations (id, job_id, source_product_id, variation_type, variation_label, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [variationId, jobId, job.source_product_id as string, v.type, v.label, now()]
    );
    created.push({ id: variationId, type: v.type, label: v.label });
  }

  // Update job counts
  await storageQuery(
    env,
    "UPDATE recycler_jobs SET variations_created = ?, status = 'completed', completed_at = ? WHERE id = ?",
    [created.length, now(), jobId]
  );

  // Run product analysis and store it
  try {
    const analysis = await analyzeProduct(job.source_product_id as string, env);
    await storageQuery(
      env,
      "UPDATE recycler_jobs SET analysis = ? WHERE id = ?",
      [JSON.stringify(analysis), jobId]
    );
  } catch {
    // Analysis is best-effort
  }

  return { variations: created };
}

// --- List Variations for a Job ---

export async function listVariations(
  jobId: string,
  env: RouterEnv
): Promise<unknown> {
  const result = await storageQuery(
    env,
    `SELECT rv.*, p.name as source_product_name
     FROM recycler_variations rv
     LEFT JOIN products p ON p.id = rv.source_product_id
     WHERE rv.job_id = ?
     ORDER BY rv.created_at ASC`,
    [jobId]
  );
  const variations = extractRows<Record<string, unknown>>(result);

  for (const v of variations) {
    if (typeof v.metadata === "string") v.metadata = JSON.parse(v.metadata as string);
  }

  return variations;
}

// --- Get Top Sellers (candidates for recycling) ---

export async function getTopSellers(
  env: RouterEnv,
  limit: number = 20
): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT
       p.id, p.name, p.niche, p.domain_id, p.category_id,
       d.name as domain_name, c.name as category_name,
       COALESCE(SUM(rr.revenue), 0) as total_revenue,
       COUNT(DISTINCT rr.external_order_id) as total_orders,
       COALESCE(SUM(rr.quantity), 0) as total_quantity
     FROM products p
     INNER JOIN revenue_records rr ON rr.product_id = p.id
     LEFT JOIN domains d ON d.id = p.domain_id
     LEFT JOIN categories c ON c.id = p.category_id
     GROUP BY p.id
     ORDER BY total_revenue DESC
     LIMIT ?`,
    [limit]
  );
}
