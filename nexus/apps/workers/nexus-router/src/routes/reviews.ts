import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService, errorResponse } from "../helpers";

const reviews = new Hono<{ Bindings: RouterEnv }>();

// GET /api/reviews/pending — list pending reviews
reviews.get("/pending", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT p.*, wr.id as run_id, wr.current_step, wr.total_steps,
              wr.total_tokens, wr.total_cost, wr.cache_hits
       FROM products p
       JOIN workflow_runs wr ON wr.product_id = p.id
       WHERE p.status = 'pending_review'
       ORDER BY p.updated_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/reviews/:productId — get review for product
reviews.get("/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");

    const data = await storageQuery(
      c.env,
      `SELECT r.*, p.name as product_name, p.status as product_status
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE r.product_id = ?
       ORDER BY r.version DESC`,
      [productId]
    );

    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/reviews/:productId/approve — approve product
reviews.post("/:productId/approve", async (c) => {
  try {
    const productId = c.req.param("productId");
    const ts = now();

    // Update product status
    await storageQuery(
      c.env,
      "UPDATE products SET status = 'approved', updated_at = ? WHERE id = ?",
      [ts, productId]
    );

    // Update workflow run status
    await storageQuery(
      c.env,
      `UPDATE workflow_runs SET status = 'approved', completed_at = ?
       WHERE product_id = ? AND status = 'pending_review'`,
      [ts, productId]
    );

    // Record the review decision
    const reviewId = generateId();
    await storageQuery(
      c.env,
      `INSERT INTO reviews (id, product_id, run_id, version, decision, reviewed_at)
       VALUES (?, ?, (SELECT id FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC LIMIT 1),
               (SELECT COALESCE(MAX(version), 0) + 1 FROM reviews WHERE product_id = ?),
               'approved', ?)`,
      [reviewId, productId, productId, productId, ts]
    );

    // Trigger platform variation + social content generation
    const products = (await storageQuery(
      c.env,
      "SELECT * FROM products WHERE id = ?",
      [productId]
    )) as Array<Record<string, unknown>>;

    if (products && (products as unknown[]).length > 0) {
      const product = products[0];
      const userInput =
        typeof product.user_input === "string"
          ? JSON.parse(product.user_input as string)
          : product.user_input ?? {};

      const baseProduct = {
        id: product.id,
        name: product.name,
        niche: product.niche,
        domain_id: product.domain_id,
        category_id: product.category_id,
      };

      // Generate platform variants if platforms specified
      const platforms: string[] = userInput.platforms ?? [];
      if (platforms.length > 0) {
        try {
          await forwardToService(
            c.env.NEXUS_VARIATION,
            "/variation/platforms",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseProduct,
                platformIds: platforms,
              }),
            }
          );
        } catch {
          console.error(
            "[ROUTER] Platform variation failed for",
            productId
          );
        }
      }

      // Generate social content if social enabled
      const socialChannels: string[] = userInput.social_channels ?? [];
      if (socialChannels.length > 0 && userInput.social_enabled) {
        try {
          await forwardToService(
            c.env.NEXUS_VARIATION,
            "/variation/socials",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseProduct,
                channelIds: socialChannels,
              }),
            }
          );
        } catch {
          console.error(
            "[ROUTER] Social variation failed for",
            productId
          );
        }
      }
    }

    return c.json<ApiResponse>({
      success: true,
      data: { product_id: productId, status: "approved" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/reviews/:productId/reject — reject with feedback
reviews.post("/:productId/reject", async (c) => {
  try {
    const productId = c.req.param("productId");
    const body = await c.req.json<{ feedback?: string }>();

    if (!body.feedback) {
      return c.json<ApiResponse>(
        { success: false, error: "feedback is required for rejection" },
        400
      );
    }

    const ts = now();

    // Update product status
    await storageQuery(
      c.env,
      "UPDATE products SET status = 'rejected', updated_at = ? WHERE id = ?",
      [ts, productId]
    );

    // Record the review decision
    const reviewId = generateId();
    await storageQuery(
      c.env,
      `INSERT INTO reviews (id, product_id, run_id, version, decision, feedback, reviewed_at)
       VALUES (?, ?, (SELECT id FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC LIMIT 1),
               (SELECT COALESCE(MAX(version), 0) + 1 FROM reviews WHERE product_id = ?),
               'rejected', ?, ?)`,
      [reviewId, productId, productId, productId, body.feedback, ts]
    );

    // Trigger revision via nexus-workflow
    const runResult = (await storageQuery(
      c.env,
      "SELECT id FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC LIMIT 1",
      [productId]
    )) as Array<{ id: string }>;

    if (runResult && (runResult as unknown[]).length > 0) {
      await forwardToService(
        c.env.NEXUS_WORKFLOW,
        `/workflow/revise/${runResult[0].id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: body.feedback }),
        }
      );
    }

    return c.json<ApiResponse>({
      success: true,
      data: { product_id: productId, status: "rejected" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default reviews;
