// ============================================================
// Campaign Service — plan campaigns weeks ahead
// "I want 200 products in Home Decor by end of month"
// System auto-distributes daily targets
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Types ---

interface CampaignCreateInput {
  name: string;
  domain_id: string;
  category_id?: string;
  target_count: number;
  deadline?: string;
  niche_keywords?: string[];
  platforms?: string[];
  social_channels?: string[];
  language?: string;
  auto_approve_threshold?: number;
}

interface CampaignUpdateInput {
  name?: string;
  domain_id?: string;
  category_id?: string;
  target_count?: number;
  deadline?: string;
  daily_target?: number;
  niche_keywords?: string[];
  platforms?: string[];
  social_channels?: string[];
  language?: string;
  auto_approve_threshold?: number;
  status?: string;
}

// --- Helper: calculate daily target ---

function calculateDailyTarget(targetCount: number, deadline?: string): number {
  if (!deadline) return targetCount; // No deadline = do it all at once

  const deadlineDate = new Date(deadline);
  const nowDate = new Date();
  const daysRemaining = Math.max(
    1,
    Math.ceil((deadlineDate.getTime() - nowDate.getTime()) / 86400000)
  );

  return Math.ceil(targetCount / daysRemaining);
}

// --- CRUD Operations ---

export async function listCampaigns(env: RouterEnv): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT c.*, d.name as domain_name, cat.name as category_name
     FROM campaigns c
     LEFT JOIN domains d ON d.id = c.domain_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     ORDER BY c.created_at DESC`
  );
}

export async function getCampaign(id: string, env: RouterEnv): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT c.*, d.name as domain_name, cat.name as category_name
     FROM campaigns c
     LEFT JOIN domains d ON d.id = c.domain_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.id = ?`,
    [id]
  );
}

export async function createCampaign(
  input: CampaignCreateInput,
  env: RouterEnv
): Promise<{ id: string; daily_target: number }> {
  const id = generateId();
  const ts = now();
  const dailyTarget = calculateDailyTarget(input.target_count, input.deadline);

  await storageQuery(
    env,
    `INSERT INTO campaigns (id, name, domain_id, category_id, target_count, daily_target,
       deadline, niche_keywords, platforms, social_channels, language,
       auto_approve_threshold, status, products_created, products_approved,
       products_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, 0, ?, ?)`,
    [
      id,
      input.name,
      input.domain_id,
      input.category_id ?? null,
      input.target_count,
      dailyTarget,
      input.deadline ?? null,
      input.niche_keywords ? JSON.stringify(input.niche_keywords) : null,
      input.platforms ? JSON.stringify(input.platforms) : null,
      input.social_channels ? JSON.stringify(input.social_channels) : null,
      input.language ?? "en",
      input.auto_approve_threshold ?? 9,
      ts,
      ts,
    ]
  );

  return { id, daily_target: dailyTarget };
}

export async function updateCampaign(
  id: string,
  input: CampaignUpdateInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { setClauses.push("name = ?"); values.push(input.name); }
  if (input.domain_id !== undefined) { setClauses.push("domain_id = ?"); values.push(input.domain_id); }
  if (input.category_id !== undefined) { setClauses.push("category_id = ?"); values.push(input.category_id); }
  if (input.target_count !== undefined) { setClauses.push("target_count = ?"); values.push(input.target_count); }
  if (input.deadline !== undefined) { setClauses.push("deadline = ?"); values.push(input.deadline); }
  if (input.daily_target !== undefined) { setClauses.push("daily_target = ?"); values.push(input.daily_target); }
  if (input.niche_keywords !== undefined) { setClauses.push("niche_keywords = ?"); values.push(JSON.stringify(input.niche_keywords)); }
  if (input.platforms !== undefined) { setClauses.push("platforms = ?"); values.push(JSON.stringify(input.platforms)); }
  if (input.social_channels !== undefined) { setClauses.push("social_channels = ?"); values.push(JSON.stringify(input.social_channels)); }
  if (input.language !== undefined) { setClauses.push("language = ?"); values.push(input.language); }
  if (input.auto_approve_threshold !== undefined) { setClauses.push("auto_approve_threshold = ?"); values.push(input.auto_approve_threshold); }
  if (input.status !== undefined) { setClauses.push("status = ?"); values.push(input.status); }

  // Recalculate daily target if target_count or deadline changed
  if (input.target_count !== undefined || input.deadline !== undefined) {
    // Get current values to merge with updates
    const current = (await storageQuery(
      env,
      "SELECT target_count, deadline FROM campaigns WHERE id = ?",
      [id]
    )) as Array<{ target_count: number; deadline: string | null }> | { results?: Array<{ target_count: number; deadline: string | null }> };

    const rows = Array.isArray(current) ? current : (current?.results ?? []);
    if (rows.length > 0) {
      const targetCount = input.target_count ?? rows[0].target_count;
      const deadline = input.deadline ?? rows[0].deadline ?? undefined;
      const dailyTarget = calculateDailyTarget(targetCount, deadline);
      setClauses.push("daily_target = ?");
      values.push(dailyTarget);
    }
  }

  if (setClauses.length === 0) return { id };

  setClauses.push("updated_at = ?");
  values.push(now());
  values.push(id);

  await storageQuery(
    env,
    `UPDATE campaigns SET ${setClauses.join(", ")} WHERE id = ?`,
    values
  );

  return { id };
}

export async function deleteCampaign(id: string, env: RouterEnv): Promise<void> {
  await storageQuery(env, "DELETE FROM campaigns WHERE id = ?", [id]);
}

// --- Campaign Progress ---

export async function getCampaignProgress(
  id: string,
  env: RouterEnv
): Promise<{
  campaign_id: string;
  target_count: number;
  daily_target: number;
  products_created: number;
  products_approved: number;
  products_published: number;
  completion_pct: number;
  days_remaining: number | null;
  on_track: boolean;
} | null> {
  const result = (await storageQuery(
    env,
    "SELECT * FROM campaigns WHERE id = ?",
    [id]
  )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };

  const rows = Array.isArray(result) ? result : (result?.results ?? []);
  if (rows.length === 0) return null;

  const campaign = rows[0];
  const targetCount = campaign.target_count as number;
  const productsCreated = campaign.products_created as number;
  const productsApproved = campaign.products_approved as number;
  const productsPublished = campaign.products_published as number;
  const deadline = campaign.deadline as string | null;
  const dailyTarget = campaign.daily_target as number;

  let daysRemaining: number | null = null;
  let onTrack = true;

  if (deadline) {
    const deadlineDate = new Date(deadline);
    daysRemaining = Math.max(
      0,
      Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)
    );

    // Check if we're on track: remaining products / remaining days <= daily target
    const remaining = targetCount - productsCreated;
    if (daysRemaining > 0) {
      onTrack = Math.ceil(remaining / daysRemaining) <= dailyTarget;
    } else {
      onTrack = productsCreated >= targetCount;
    }
  }

  return {
    campaign_id: id,
    target_count: targetCount,
    daily_target: dailyTarget,
    products_created: productsCreated,
    products_approved: productsApproved,
    products_published: productsPublished,
    completion_pct: targetCount > 0 ? Math.round((productsCreated / targetCount) * 100) : 0,
    days_remaining: daysRemaining,
    on_track: onTrack,
  };
}

// --- Increment Campaign Counters ---

export async function incrementCampaignCounter(
  campaignId: string,
  field: "products_created" | "products_approved" | "products_published",
  env: RouterEnv
): Promise<void> {
  await storageQuery(
    env,
    `UPDATE campaigns SET ${field} = ${field} + 1, updated_at = ? WHERE id = ?`,
    [now(), campaignId]
  );

  // Check if campaign is complete
  const result = (await storageQuery(
    env,
    "SELECT target_count, products_created FROM campaigns WHERE id = ?",
    [campaignId]
  )) as Array<{ target_count: number; products_created: number }> | { results?: Array<{ target_count: number; products_created: number }> };

  const rows = Array.isArray(result) ? result : (result?.results ?? []);
  if (rows.length > 0 && rows[0].products_created >= rows[0].target_count) {
    await storageQuery(
      env,
      "UPDATE campaigns SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'active'",
      [now(), campaignId]
    );
  }
}
