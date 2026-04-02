// ============================================================
// A/B Testing Automation Service
// Auto-generate variants during product creation,
// auto-winner selection after threshold,
// feed A/B results back to AI for learning
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService } from "../helpers";

// --- Types ---

interface ABTestRow {
  id: string;
  product_id: string;
  platform_id: string | null;
  status: string;
  winning_variant: string | null;
  started_at: string;
  ended_at: string | null;
}

interface ABVariantRow {
  id: string;
  test_id: string;
  variant_label: string;
  title: string;
  description: string;
  tags: string | null;
  views: number;
  clicks: number;
  sales: number;
  revenue: number;
  conversion_rate: number;
  is_active: number;
}

/**
 * Auto-generate A/B test variants for a product using AI.
 * Creates 2-3 variants with different titles/descriptions.
 */
export async function autoGenerateVariants(
  productId: string,
  env: RouterEnv
): Promise<{ test_id: string; variants_created: number } | null> {
  // Get the product details
  const products = (await storageQuery<Array<{
    id: string;
    niche: string;
    name: string;
    description: string;
    platforms: string | null;
  }>>(
    env,
    `SELECT id, niche, name, description, platforms FROM products WHERE id = ?`,
    [productId]
  )) ?? [];

  if (products.length === 0) return null;
  const product = products[0];

  // Check if product already has an A/B test
  const existingTests = (await storageQuery<Array<{ id: string }>>(
    env,
    `SELECT id FROM ab_tests WHERE product_id = ? AND status = 'running'`,
    [productId]
  )) ?? [];

  if (existingTests.length > 0) return null;

  // Use AI to generate variant titles and descriptions
  const aiResult = await forwardToService(
    env.NEXUS_AI,
    "/ai/run",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskType: "variation",
        prompt: `Generate 3 A/B test variants for this digital product listing. Each variant should have a different angle/approach to the title and description while promoting the same product.

Product: ${product.name || product.niche}
Current Description: ${(product.description || "").slice(0, 500)}

Return JSON with this exact structure:
{
  "variants": [
    { "title": "variant A title", "description": "variant A description (2-3 sentences)", "angle": "what makes this variant different" },
    { "title": "variant B title", "description": "variant B description (2-3 sentences)", "angle": "what makes this variant different" },
    { "title": "variant C title", "description": "variant C description (2-3 sentences)", "angle": "what makes this variant different" }
  ]
}`,
      }),
    }
  );

  if (!aiResult.success || !aiResult.data) return null;

  // Parse AI response
  const aiData = aiResult.data as { result?: string };
  let variants: Array<{ title: string; description: string; angle?: string }> = [];

  try {
    const parsed = JSON.parse(aiData.result ?? "{}");
    variants = parsed.variants ?? [];
  } catch {
    // Try to extract JSON from markdown code block
    const match = (aiData.result ?? "").match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1].trim());
        variants = parsed.variants ?? [];
      } catch {
        return null;
      }
    }
  }

  if (variants.length < 2) return null;

  // Create the A/B test
  const testId = generateId();
  await storageQuery(
    env,
    `INSERT INTO ab_tests (id, product_id, status, started_at, created_at)
     VALUES (?, ?, 'running', ?, ?)`,
    [testId, productId, now(), now()]
  );

  // Create variants
  const labels = ["A", "B", "C"];
  let created = 0;
  for (let i = 0; i < Math.min(variants.length, 3); i++) {
    const v = variants[i];
    const variantId = generateId();
    await storageQuery(
      env,
      `INSERT INTO ab_variants (id, test_id, variant_label, title, description, is_active, activated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [variantId, testId, labels[i], v.title, v.description, i === 0 ? 1 : 0, i === 0 ? now() : null]
    );
    created++;
  }

  return { test_id: testId, variants_created: created };
}

/**
 * Check all running A/B tests for auto-winner selection.
 * A winner is selected when:
 * - At least one variant has >= threshold views
 * - There's a statistically meaningful difference in conversion rates
 */
export async function checkAutoWinners(
  env: RouterEnv,
  viewThreshold: number = 100
): Promise<{
  tests_checked: number;
  winners_selected: number;
  results: Array<{ test_id: string; winner: string | null; status: string }>;
}> {
  const runningTests = (await storageQuery<ABTestRow[]>(
    env,
    `SELECT * FROM ab_tests WHERE status = 'running'`
  )) ?? [];

  const results: Array<{ test_id: string; winner: string | null; status: string }> = [];
  let winnersSelected = 0;

  for (const test of runningTests) {
    const variants = (await storageQuery<ABVariantRow[]>(
      env,
      `SELECT * FROM ab_variants WHERE test_id = ? ORDER BY variant_label ASC`,
      [test.id]
    )) ?? [];

    if (variants.length < 2) {
      results.push({ test_id: test.id, winner: null, status: "skipped: not enough variants" });
      continue;
    }

    // Check if any variant has enough views
    const totalViews = variants.reduce((sum, v) => sum + (v.views ?? 0), 0);
    if (totalViews < viewThreshold) {
      results.push({ test_id: test.id, winner: null, status: `waiting: ${totalViews}/${viewThreshold} views` });
      continue;
    }

    // Find the winner based on conversion rate
    const sorted = [...variants].sort((a, b) => (b.conversion_rate ?? 0) - (a.conversion_rate ?? 0));
    const best = sorted[0];
    const secondBest = sorted[1];

    // Require at least 20% better conversion rate for a clear winner
    const convDiff = best.conversion_rate - secondBest.conversion_rate;
    const relDiff = secondBest.conversion_rate > 0
      ? convDiff / secondBest.conversion_rate
      : (best.conversion_rate > 0 ? 1 : 0);

    if (relDiff >= 0.2 || totalViews >= viewThreshold * 3) {
      // Clear winner or enough data to declare
      await storageQuery(
        env,
        `UPDATE ab_tests SET status = 'completed', winning_variant = ?, ended_at = ? WHERE id = ?`,
        [best.variant_label, now(), test.id]
      );

      winnersSelected++;
      results.push({ test_id: test.id, winner: best.variant_label, status: "winner selected" });

      // Store learning data for AI feedback
      await storeABLearning(test.id, best, variants, env);
    } else {
      results.push({ test_id: test.id, winner: null, status: "running: no clear winner yet" });
    }
  }

  return { tests_checked: runningTests.length, winners_selected: winnersSelected, results };
}

/**
 * Store A/B test results in KV for AI learning.
 */
async function storeABLearning(
  testId: string,
  winner: ABVariantRow,
  allVariants: ABVariantRow[],
  env: RouterEnv
): Promise<void> {
  try {
    const learningData = {
      test_id: testId,
      winner: {
        label: winner.variant_label,
        title: winner.title,
        description: winner.description,
        conversion_rate: winner.conversion_rate,
        views: winner.views,
        sales: winner.sales,
      },
      losers: allVariants
        .filter((v) => v.id !== winner.id)
        .map((v) => ({
          label: v.variant_label,
          title: v.title,
          conversion_rate: v.conversion_rate,
          views: v.views,
          sales: v.sales,
        })),
      timestamp: now(),
    };

    await env.NEXUS_STORAGE.fetch(`http://nexus-storage/kv/ab:learning:${testId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: `ab:learning:${testId}`,
        value: JSON.stringify(learningData),
        metadata: { updated_at: now() },
      }),
    });
  } catch (err) {
    console.error("[AB-TESTING] Failed to store learning data:", err instanceof Error ? err.message : String(err));
  }
}
