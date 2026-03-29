// ============================================================
// Review Service — business logic for product approval/rejection
// Extracted from routes/reviews.ts to keep router thin
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService } from "../helpers";

/**
 * Approve a product: update status, record review, trigger variation generation.
 */
export async function approveProduct(
  productId: string,
  env: RouterEnv
): Promise<{ product_id: string; status: string }> {
  const ts = now();

  // Update product status
  await storageQuery(
    env,
    "UPDATE products SET status = 'approved', updated_at = ? WHERE id = ?",
    [ts, productId]
  );

  // Update workflow run status
  await storageQuery(
    env,
    `UPDATE workflow_runs SET status = 'approved', completed_at = ?
     WHERE product_id = ? AND status = 'pending_review'`,
    [ts, productId]
  );

  // Record the review decision
  const reviewId = generateId();
  await storageQuery(
    env,
    `INSERT INTO reviews (id, product_id, run_id, version, decision, reviewed_at)
     VALUES (?, ?, (SELECT id FROM workflow_runs WHERE product_id = ? AND status = 'approved' ORDER BY started_at DESC LIMIT 1),
             (SELECT COALESCE(MAX(version), 0) + 1 FROM reviews WHERE product_id = ?),
             'approved', ?)`,
    [reviewId, productId, productId, productId, ts]
  );

  // Trigger platform variation + social content generation
  await triggerVariationGeneration(productId, env);

  return { product_id: productId, status: "approved" };
}

/**
 * Reject a product: update status, record review with feedback, trigger revision.
 */
export async function rejectProduct(
  productId: string,
  feedback: string,
  env: RouterEnv
): Promise<{ product_id: string; status: string }> {
  const ts = now();

  // Update product status
  await storageQuery(
    env,
    "UPDATE products SET status = 'rejected', updated_at = ? WHERE id = ?",
    [ts, productId]
  );

  // Record the review decision
  const reviewId = generateId();
  await storageQuery(
    env,
    `INSERT INTO reviews (id, product_id, run_id, version, decision, feedback, reviewed_at)
     VALUES (?, ?, (SELECT id FROM workflow_runs WHERE product_id = ? AND status IN ('pending_review', 'in_revision') ORDER BY started_at DESC LIMIT 1),
             (SELECT COALESCE(MAX(version), 0) + 1 FROM reviews WHERE product_id = ?),
             'rejected', ?, ?)`,
    [reviewId, productId, productId, productId, feedback, ts]
  );

  // Trigger revision via nexus-workflow
  const runResult = (await storageQuery(
    env,
    "SELECT id FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC LIMIT 1",
    [productId]
  )) as Array<{ id: string }>;

  if (runResult && (runResult as unknown[]).length > 0) {
    await forwardToService(
      env.NEXUS_WORKFLOW,
      `/workflow/revise/${runResult[0].id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      }
    );
  }

  return { product_id: productId, status: "rejected" };
}

/**
 * After approval, trigger platform and social variation generation.
 */
async function triggerVariationGeneration(
  productId: string,
  env: RouterEnv
): Promise<void> {
  const products = (await storageQuery(
    env,
    "SELECT * FROM products WHERE id = ?",
    [productId]
  )) as Array<Record<string, unknown>>;

  if (!products || (products as unknown[]).length === 0) return;

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
        env.NEXUS_VARIATION,
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
      console.error("[REVIEW-SERVICE] Platform variation failed for", productId);
    }
  }

  // Generate social content if social enabled
  const socialChannels: string[] = userInput.social_channels ?? [];
  if (socialChannels.length > 0 && userInput.social_enabled) {
    try {
      await forwardToService(
        env.NEXUS_VARIATION,
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
      console.error("[REVIEW-SERVICE] Social variation failed for", productId);
    }
  }
}
