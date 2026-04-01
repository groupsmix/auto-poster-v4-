// ============================================================
// Publish Service — automatic platform publishing with queue & retry
// Phase 1: Etsy auto-publish after approval
// Extensible for Gumroad, Pinterest, etc. in future phases
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { PublishQueueStatus } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";
import { createEtsyListing } from "./etsy-service";
import type { EtsyPublishResult } from "./etsy-service";

/** Maximum retry attempts per publish job */
const MAX_PUBLISH_ATTEMPTS = 3;

/** Base delay for exponential backoff (ms) */
const BACKOFF_BASE_MS = 2000;

// ── Queue Management ────────────────────────────────────────

/**
 * Enqueue a product for publishing to a specific platform.
 * Skips if a queue entry already exists for this product+platform combo.
 */
export async function enqueuePublish(
  productId: string,
  platform: string,
  env: RouterEnv
): Promise<{ id: string; skipped: boolean }> {
  // Check if already queued or published for this product+platform
  const existing = await storageQuery<Array<{ id: string; status: string }>>(
    env,
    `SELECT id, status FROM publish_queue
     WHERE product_id = ? AND platform = ? AND status IN ('pending', 'publishing', 'published')
     LIMIT 1`,
    [productId, platform]
  );

  if (existing && existing.length > 0) {
    return { id: existing[0].id, skipped: true };
  }

  const id = generateId();
  await storageQuery(
    env,
    `INSERT INTO publish_queue (id, product_id, platform, status, attempts, max_attempts, created_at)
     VALUES (?, ?, ?, 'pending', 0, ?, ?)`,
    [id, productId, platform, MAX_PUBLISH_ATTEMPTS, now()]
  );

  return { id, skipped: false };
}

/**
 * After a product is approved, check if auto-publish is enabled
 * and enqueue publishing to configured platforms.
 */
export async function autoPublishAfterApproval(
  productId: string,
  env: RouterEnv
): Promise<{ queued: string[]; skipped: string[] }> {
  const queued: string[] = [];
  const skipped: string[] = [];

  // Check if auto-publish to Etsy is enabled
  const etsyEnabled = await isAutoPublishEnabled(env, "etsy");
  if (!etsyEnabled) {
    return { queued, skipped };
  }

  // Check if the product has an Etsy platform variant
  const etsyVariant = await storageQuery<Array<{ id: string }>>(
    env,
    `SELECT pv.id FROM platform_variants pv
     JOIN platforms pl ON pl.id = pv.platform_id
     WHERE pv.product_id = ? AND pl.slug = 'etsy'
     LIMIT 1`,
    [productId]
  );

  if (etsyVariant && etsyVariant.length > 0) {
    const result = await enqueuePublish(productId, "etsy", env);
    if (result.skipped) {
      skipped.push("etsy");
    } else {
      queued.push("etsy");
    }
  }

  // Future phases: check gumroad, pinterest, etc. here

  return { queued, skipped };
}

/**
 * Check if auto-publish is enabled for a given platform.
 * Requires BOTH the general auto_publish_after_approval AND
 * the platform-specific auto_publish_{platform} setting to be true.
 */
async function isAutoPublishEnabled(
  env: RouterEnv,
  platform: string
): Promise<boolean> {
  // Check general auto-publish toggle first
  const generalRows = await storageQuery<Array<{ value: string }>>(
    env,
    "SELECT value FROM settings WHERE key = 'auto_publish_after_approval' LIMIT 1",
    []
  );
  const generalEnabled = generalRows && generalRows.length > 0 &&
    (generalRows[0].value === "true" || generalRows[0].value === "1");

  if (!generalEnabled) return false;

  // Check platform-specific toggle
  const settingKey = `auto_publish_${platform}`;
  const rows = await storageQuery<Array<{ value: string }>>(
    env,
    "SELECT value FROM settings WHERE key = ? LIMIT 1",
    [settingKey]
  );

  if (!rows || rows.length === 0) return false;
  return rows[0].value === "true" || rows[0].value === "1";
}

// ── Queue Processing (called by cron) ───────────────────────

/**
 * Process all pending items in the publish queue.
 * Called by the cron handler every 15 minutes.
 */
export async function processPublishQueue(env: RouterEnv): Promise<{
  processed: number;
  published: number;
  failed: number;
  results: Array<{ id: string; platform: string; status: string; error?: string }>;
}> {
  // Fetch pending items (ordered by creation time)
  const pendingItems = await storageQuery<Array<{
    id: string;
    product_id: string;
    platform: string;
    attempts: number;
    max_attempts: number;
  }>>(
    env,
    `SELECT id, product_id, platform, attempts, max_attempts
     FROM publish_queue
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 10`,
    []
  );

  if (!pendingItems || pendingItems.length === 0) {
    return { processed: 0, published: 0, failed: 0, results: [] };
  }

  let published = 0;
  let failed = 0;
  const results: Array<{ id: string; platform: string; status: string; error?: string }> = [];

  for (const item of pendingItems) {
    // Mark as publishing
    await storageQuery(
      env,
      "UPDATE publish_queue SET status = 'publishing', attempts = attempts + 1 WHERE id = ?",
      [item.id]
    );

    try {
      const publishResult = await publishToPlatform(item.product_id, item.platform, env);

      // Mark as published
      await storageQuery(
        env,
        `UPDATE publish_queue
         SET status = 'published', external_id = ?, external_url = ?, published_at = ?, error = NULL
         WHERE id = ?`,
        [publishResult.external_id, publishResult.external_url, now(), item.id]
      );

      // Update platform_variants with external tracking
      await storageQuery(
        env,
        `UPDATE platform_variants
         SET external_id = ?, external_url = ?, published_via = 'auto', publish_error = NULL
         WHERE product_id = ? AND platform_id IN (SELECT id FROM platforms WHERE slug = ?)`,
        [publishResult.external_id, publishResult.external_url, item.product_id, item.platform]
      );

      published++;
      results.push({ id: item.id, platform: item.platform, status: "published" });
      console.log(`[PUBLISH] Successfully published ${item.product_id} to ${item.platform}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const newAttempts = item.attempts + 1;

      if (newAttempts >= item.max_attempts) {
        // Max retries exceeded — mark as failed
        await storageQuery(
          env,
          "UPDATE publish_queue SET status = 'failed', error = ? WHERE id = ?",
          [errorMessage, item.id]
        );

        // Update platform_variants with error
        await storageQuery(
          env,
          `UPDATE platform_variants
           SET publish_error = ?
           WHERE product_id = ? AND platform_id IN (SELECT id FROM platforms WHERE slug = ?)`,
          [errorMessage, item.product_id, item.platform]
        );

        failed++;
        results.push({ id: item.id, platform: item.platform, status: "failed", error: errorMessage });
        console.error(`[PUBLISH] Failed after ${newAttempts} attempts: ${item.product_id} to ${item.platform}: ${errorMessage}`);
      } else {
        // Reset to pending for retry (with exponential backoff — processed on next cron tick)
        await storageQuery(
          env,
          "UPDATE publish_queue SET status = 'pending', error = ? WHERE id = ?",
          [errorMessage, item.id]
        );

        results.push({ id: item.id, platform: item.platform, status: "retry", error: errorMessage });
        console.warn(`[PUBLISH] Attempt ${newAttempts}/${item.max_attempts} failed for ${item.product_id} to ${item.platform}: ${errorMessage}`);
      }
    }
  }

  return { processed: pendingItems.length, published, failed, results };
}

/**
 * Dispatch publishing to the correct platform service.
 */
async function publishToPlatform(
  productId: string,
  platform: string,
  env: RouterEnv
): Promise<{ external_id: string; external_url: string }> {
  switch (platform) {
    case "etsy": {
      const result: EtsyPublishResult = await createEtsyListing(env, productId);
      return {
        external_id: result.listing_id,
        external_url: result.url,
      };
    }
    // Future phases: gumroad, pinterest, etc.
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// ── Queue Query Helpers ─────────────────────────────────────

/**
 * Get all publish queue items, optionally filtered by status.
 */
export async function getPublishQueue(
  env: RouterEnv,
  status?: PublishQueueStatus
): Promise<unknown> {
  if (status) {
    return storageQuery(
      env,
      `SELECT pq.*, p.name as product_name
       FROM publish_queue pq
       LEFT JOIN products p ON p.id = pq.product_id
       WHERE pq.status = ?
       ORDER BY pq.created_at DESC`,
      [status]
    );
  }

  return storageQuery(
    env,
    `SELECT pq.*, p.name as product_name
     FROM publish_queue pq
     LEFT JOIN products p ON p.id = pq.product_id
     ORDER BY pq.created_at DESC`
  );
}

/**
 * Retry a failed publish queue item (reset status to pending).
 */
export async function retryPublishItem(
  queueId: string,
  env: RouterEnv
): Promise<{ id: string; status: string }> {
  // Get current item
  const items = await storageQuery<Array<{ id: string; status: string; attempts: number }>>(
    env,
    "SELECT id, status, attempts FROM publish_queue WHERE id = ? LIMIT 1",
    [queueId]
  );

  if (!items || items.length === 0) {
    throw new Error("Publish queue item not found");
  }

  const item = items[0];
  if (item.status !== "failed") {
    throw new Error(`Cannot retry item with status '${item.status}'. Only failed items can be retried.`);
  }

  // Reset to pending with fresh attempt count
  await storageQuery(
    env,
    "UPDATE publish_queue SET status = 'pending', attempts = 0, error = NULL WHERE id = ?",
    [queueId]
  );

  return { id: queueId, status: "pending" };
}

/**
 * Cancel a pending publish queue item.
 */
export async function cancelPublishItem(
  queueId: string,
  env: RouterEnv
): Promise<{ id: string; status: string }> {
  const items = await storageQuery<Array<{ id: string; status: string }>>(
    env,
    "SELECT id, status FROM publish_queue WHERE id = ? LIMIT 1",
    [queueId]
  );

  if (!items || items.length === 0) {
    throw new Error("Publish queue item not found");
  }

  if (items[0].status !== "pending") {
    throw new Error(`Cannot cancel item with status '${items[0].status}'. Only pending items can be cancelled.`);
  }

  await storageQuery(
    env,
    "DELETE FROM publish_queue WHERE id = ?",
    [queueId]
  );

  return { id: queueId, status: "cancelled" };
}
