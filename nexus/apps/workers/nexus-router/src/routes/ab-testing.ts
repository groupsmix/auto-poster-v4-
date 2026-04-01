import { Hono } from "hono";
import type { ApiResponse, ABTest, ABVariant } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const abTesting = new Hono<{ Bindings: RouterEnv }>();

// GET /api/ab-testing — list all A/B tests with variants
abTesting.get("/", async (c) => {
  try {
    const tests = await storageQuery<ABTest[]>(
      c.env,
      `SELECT t.*, p.niche as product_name
       FROM ab_tests t
       LEFT JOIN products p ON p.id = t.product_id
       ORDER BY t.created_at DESC`
    );

    // Fetch variants for each test
    const testIds = tests.map((t) => t.id);
    let variants: ABVariant[] = [];
    if (testIds.length > 0) {
      const placeholders = testIds.map(() => "?").join(",");
      variants = await storageQuery<ABVariant[]>(
        c.env,
        `SELECT * FROM ab_variants WHERE test_id IN (${placeholders}) ORDER BY variant_label ASC`,
        testIds
      );
    }

    const testsWithVariants = tests.map((t) => ({
      ...t,
      variants: variants.filter((v) => v.test_id === t.id),
    }));

    return c.json<ApiResponse>({ success: true, data: testsWithVariants });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/ab-testing/:id — get single test with variants
abTesting.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const tests = await storageQuery<ABTest[]>(
      c.env,
      `SELECT t.*, p.niche as product_name
       FROM ab_tests t
       LEFT JOIN products p ON p.id = t.product_id
       WHERE t.id = ?`,
      [id]
    );

    if (!tests.length) {
      return c.json<ApiResponse>({ success: false, error: "Test not found" }, 404);
    }

    const variants = await storageQuery<ABVariant[]>(
      c.env,
      `SELECT * FROM ab_variants WHERE test_id = ? ORDER BY variant_label ASC`,
      [id]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { ...tests[0], variants },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/ab-testing — create a new A/B test with variants
abTesting.post("/", async (c) => {
  try {
    const body = await c.req.json<{
      product_id: string;
      platform_id?: string;
      variants: Array<{
        title: string;
        description: string;
        tags?: string[];
      }>;
    }>();

    if (!body.product_id || !body.variants?.length) {
      return c.json<ApiResponse>(
        { success: false, error: "product_id and variants are required" },
        400
      );
    }

    if (body.variants.length < 2 || body.variants.length > 3) {
      return c.json<ApiResponse>(
        { success: false, error: "Provide 2-3 variants" },
        400
      );
    }

    const testId = crypto.randomUUID();
    await storageQuery(
      c.env,
      `INSERT INTO ab_tests (id, product_id, platform_id) VALUES (?, ?, ?)`,
      [testId, body.product_id, body.platform_id ?? null]
    );

    const labels = ["A", "B", "C"];
    for (let i = 0; i < body.variants.length; i++) {
      const v = body.variants[i];
      const variantId = crypto.randomUUID();
      await storageQuery(
        c.env,
        `INSERT INTO ab_variants (id, test_id, variant_label, title, description, tags, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          variantId,
          testId,
          labels[i],
          v.title,
          v.description,
          v.tags ? JSON.stringify(v.tags) : null,
          i === 0 ? 1 : 0,
        ]
      );
    }

    // Activate first variant
    const firstVariant = await storageQuery<ABVariant[]>(
      c.env,
      `SELECT id FROM ab_variants WHERE test_id = ? AND variant_label = 'A'`,
      [testId]
    );
    if (firstVariant.length) {
      await storageQuery(
        c.env,
        `UPDATE ab_variants SET activated_at = datetime('now') WHERE id = ?`,
        [firstVariant[0].id]
      );
    }

    return c.json<ApiResponse>({ success: true, data: { id: testId } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/ab-testing/:id/variant/:variantId/metrics — update variant metrics
abTesting.put("/:id/variant/:variantId/metrics", async (c) => {
  try {
    const variantId = c.req.param("variantId");
    const body = await c.req.json<{
      views?: number;
      clicks?: number;
      sales?: number;
      revenue?: number;
    }>();

    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.views !== undefined) { fields.push("views = ?"); params.push(body.views); }
    if (body.clicks !== undefined) { fields.push("clicks = ?"); params.push(body.clicks); }
    if (body.sales !== undefined) { fields.push("sales = ?"); params.push(body.sales); }
    if (body.revenue !== undefined) { fields.push("revenue = ?"); params.push(body.revenue); }

    if (fields.length === 0) {
      return c.json<ApiResponse>({ success: false, error: "No metrics to update" }, 400);
    }

    // Also recalculate conversion rate
    fields.push("conversion_rate = CASE WHEN views > 0 THEN ROUND(CAST(sales AS REAL) / views * 100, 2) ELSE 0 END");
    params.push(variantId);

    await storageQuery(
      c.env,
      `UPDATE ab_variants SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id: variantId } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/ab-testing/:id/complete — mark test as completed with winner
abTesting.post("/:id/complete", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{ winning_variant?: string }>();

    // If no winner specified, pick the one with highest conversion
    let winner = body.winning_variant;
    if (!winner) {
      const variants = await storageQuery<ABVariant[]>(
        c.env,
        `SELECT id, variant_label, conversion_rate FROM ab_variants
         WHERE test_id = ? ORDER BY conversion_rate DESC LIMIT 1`,
        [id]
      );
      winner = variants[0]?.variant_label;
    }

    await storageQuery(
      c.env,
      `UPDATE ab_tests SET status = 'completed', winning_variant = ?, ended_at = datetime('now') WHERE id = ?`,
      [winner, id]
    );

    return c.json<ApiResponse>({ success: true, data: { id, winning_variant: winner } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/ab-testing/:id — delete a test and its variants
abTesting.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, `DELETE FROM ab_variants WHERE test_id = ?`, [id]);
    await storageQuery(c.env, `DELETE FROM ab_tests WHERE id = ?`, [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default abTesting;
