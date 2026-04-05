// ============================================================
// Scheduler Service — cron-driven automatic product creation
// Picks next niche/category, runs full 9-step pipeline,
// applies auto-approve thresholds
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService } from "../helpers";

// --- Types ---

interface ScheduleRow {
  id: string;
  name: string;
  domain_id: string;
  category_id: string | null;
  niche_keywords: string | null;
  products_per_run: number;
  interval_hours: number;
  platforms: string | null;
  social_channels: string | null;
  language: string;
  auto_approve_threshold: number;
  auto_revise_min_score: number;
  max_auto_revisions: number;
  is_active: number;
  last_run_at: string | null;
  next_run_at: string | null;
  total_products_created: number;
}

interface ScheduleCreateInput {
  name: string;
  domain_id: string;
  category_id?: string;
  niche_keywords?: string[];
  products_per_run?: number;
  interval_hours?: number;
  platforms?: string[];
  social_channels?: string[];
  language?: string;
  auto_approve_threshold?: number;
  auto_revise_min_score?: number;
  max_auto_revisions?: number;
}

interface ScheduleUpdateInput {
  name?: string;
  domain_id?: string;
  category_id?: string;
  niche_keywords?: string[];
  products_per_run?: number;
  interval_hours?: number;
  platforms?: string[];
  social_channels?: string[];
  language?: string;
  auto_approve_threshold?: number;
  auto_revise_min_score?: number;
  max_auto_revisions?: number;
  is_active?: boolean;
}

// --- CRUD Operations ---

export async function listSchedules(env: RouterEnv): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT s.*, d.name as domain_name, c.name as category_name
     FROM schedules s
     LEFT JOIN domains d ON d.id = s.domain_id
     LEFT JOIN categories c ON c.id = s.category_id
     ORDER BY s.created_at DESC`
  );
}

export async function getSchedule(id: string, env: RouterEnv): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT s.*, d.name as domain_name, c.name as category_name
     FROM schedules s
     LEFT JOIN domains d ON d.id = s.domain_id
     LEFT JOIN categories c ON c.id = s.category_id
     WHERE s.id = ?`,
    [id]
  );
}

export async function createSchedule(
  input: ScheduleCreateInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const id = generateId();
  const ts = now();
  const intervalHours = input.interval_hours ?? 24;

  // Calculate next run time
  const nextRunAt = new Date(Date.now() + intervalHours * 3600000).toISOString();

  await storageQuery(
    env,
    `INSERT INTO schedules (id, name, domain_id, category_id, niche_keywords, products_per_run,
       interval_hours, platforms, social_channels, language, auto_approve_threshold,
       auto_revise_min_score, max_auto_revisions, is_active, next_run_at, total_products_created,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?)`,
    [
      id,
      input.name,
      input.domain_id,
      input.category_id ?? null,
      input.niche_keywords ? JSON.stringify(input.niche_keywords) : null,
      input.products_per_run ?? 1,
      intervalHours,
      input.platforms ? JSON.stringify(input.platforms) : null,
      input.social_channels ? JSON.stringify(input.social_channels) : null,
      input.language ?? "en",
      input.auto_approve_threshold ?? 9,
      input.auto_revise_min_score ?? 7,
      input.max_auto_revisions ?? 2,
      nextRunAt,
      ts,
      ts,
    ]
  );

  return { id };
}

export async function updateSchedule(
  id: string,
  input: ScheduleUpdateInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { setClauses.push("name = ?"); values.push(input.name); }
  if (input.domain_id !== undefined) { setClauses.push("domain_id = ?"); values.push(input.domain_id); }
  if (input.category_id !== undefined) { setClauses.push("category_id = ?"); values.push(input.category_id); }
  if (input.niche_keywords !== undefined) { setClauses.push("niche_keywords = ?"); values.push(JSON.stringify(input.niche_keywords)); }
  if (input.products_per_run !== undefined) { setClauses.push("products_per_run = ?"); values.push(input.products_per_run); }
  if (input.interval_hours !== undefined) { setClauses.push("interval_hours = ?"); values.push(input.interval_hours); }
  if (input.platforms !== undefined) { setClauses.push("platforms = ?"); values.push(JSON.stringify(input.platforms)); }
  if (input.social_channels !== undefined) { setClauses.push("social_channels = ?"); values.push(JSON.stringify(input.social_channels)); }
  if (input.language !== undefined) { setClauses.push("language = ?"); values.push(input.language); }
  if (input.auto_approve_threshold !== undefined) { setClauses.push("auto_approve_threshold = ?"); values.push(input.auto_approve_threshold); }
  if (input.auto_revise_min_score !== undefined) { setClauses.push("auto_revise_min_score = ?"); values.push(input.auto_revise_min_score); }
  if (input.max_auto_revisions !== undefined) { setClauses.push("max_auto_revisions = ?"); values.push(input.max_auto_revisions); }
  if (input.is_active !== undefined) { setClauses.push("is_active = ?"); values.push(input.is_active ? 1 : 0); }

  if (setClauses.length === 0) return { id };

  setClauses.push("updated_at = ?");
  values.push(now());
  values.push(id);

  await storageQuery(
    env,
    `UPDATE schedules SET ${setClauses.join(", ")} WHERE id = ?`,
    values
  );

  return { id };
}

export async function deleteSchedule(id: string, env: RouterEnv): Promise<void> {
  await storageQuery(env, "DELETE FROM schedules WHERE id = ?", [id]);
}

export async function toggleSchedule(id: string, active: boolean, env: RouterEnv): Promise<void> {
  await storageQuery(
    env,
    "UPDATE schedules SET is_active = ?, updated_at = ? WHERE id = ?",
    [active ? 1 : 0, now(), id]
  );
}

// --- Schedule Runs ---

export async function getScheduleRuns(scheduleId: string, env: RouterEnv): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT * FROM schedule_runs WHERE schedule_id = ? ORDER BY started_at DESC LIMIT 50`,
    [scheduleId]
  );
}

// --- Cron Tick: Execute Due Schedules ---

/**
 * Execute all schedules that are due to run.
 * Uses a concurrency guard: before executing a schedule, checks if it already
 * has a 'running' schedule_run. This prevents duplicate executions when a
 * previous cron trigger hasn't finished yet.
 */
export async function executeDueSchedules(env: RouterEnv): Promise<{
  executed: number;
  skipped: number;
  results: Array<{ schedule_id: string; schedule_name: string; products_created: number; status: string }>;
}> {
  const ts = now();

  // Get all active schedules that are due to run
  const rows = (await storageQuery<ScheduleRow[]>(
    env,
    `SELECT * FROM schedules WHERE is_active = 1 AND (next_run_at IS NULL OR next_run_at <= ?)
     ORDER BY next_run_at ASC`,
    [ts]
  )) ?? [];

  const results: Array<{ schedule_id: string; schedule_name: string; products_created: number; status: string }> = [];
  let skipped = 0;

  for (const schedule of rows) {
    try {
      // Concurrency guard: skip if this schedule already has a running execution
      const runningRuns = (await storageQuery<Array<{ id: string }>>(
        env,
        `SELECT id FROM schedule_runs WHERE schedule_id = ? AND status = 'running' LIMIT 1`,
        [schedule.id]
      )) ?? [];

      if (runningRuns.length > 0) {
        console.log(`[SCHEDULER] Skipping schedule ${schedule.id} — already running (run: ${runningRuns[0].id})`);
        skipped++;
        results.push({
          schedule_id: schedule.id,
          schedule_name: schedule.name,
          products_created: 0,
          status: "skipped: already running",
        });
        continue;
      }

      const runResult = await executeSchedule(schedule, env);
      results.push({
        schedule_id: schedule.id,
        schedule_name: schedule.name,
        products_created: runResult.products_created,
        status: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[SCHEDULER] Failed to execute schedule ${schedule.id}: ${message}`);
      results.push({
        schedule_id: schedule.id,
        schedule_name: schedule.name,
        products_created: 0,
        status: `error: ${message}`,
      });
    }
  }

  return { executed: results.length - skipped, skipped, results };
}

// --- Execute Single Schedule ---

async function executeSchedule(
  schedule: ScheduleRow,
  env: RouterEnv
): Promise<{ products_created: number }> {
  const runId = generateId();
  const ts = now();

  // Create schedule run record
  await storageQuery(
    env,
    `INSERT INTO schedule_runs (id, schedule_id, status, products_created, products_approved, products_failed, started_at)
     VALUES (?, ?, 'running', 0, 0, 0, ?)`,
    [runId, schedule.id, ts]
  );

  let productsCreated = 0;
  let productsFailed = 0;
  const productsPerRun = schedule.products_per_run ?? 1;

  try {
    // Resolve category: if no category specified, pick a random one from the domain
    let categoryId = schedule.category_id;
    if (!categoryId) {
      const catRows = (await storageQuery<Array<{ id: string }>>(
        env,
        "SELECT id FROM categories WHERE domain_id = ? AND is_active = 1 ORDER BY RANDOM() LIMIT 1",
        [schedule.domain_id]
      )) ?? [];

      if (catRows.length > 0) {
        categoryId = catRows[0].id;
      }
    }

    if (!categoryId) {
      throw new Error("No active categories found for domain");
    }

    // Build niche from keywords or use domain/category as fallback
    const nicheKeywords = schedule.niche_keywords
      ? (typeof schedule.niche_keywords === "string"
          ? JSON.parse(schedule.niche_keywords) as string[]
          : schedule.niche_keywords)
      : null;

    const platforms = schedule.platforms
      ? (typeof schedule.platforms === "string"
          ? JSON.parse(schedule.platforms) as string[]
          : schedule.platforms)
      : [];

    const socialChannels = schedule.social_channels
      ? (typeof schedule.social_channels === "string"
          ? JSON.parse(schedule.social_channels) as string[]
          : schedule.social_channels)
      : [];

    // Create products via workflow service
    for (let i = 0; i < productsPerRun; i++) {
      const niche = nicheKeywords && nicheKeywords.length > 0
        ? nicheKeywords[i % nicheKeywords.length]
        : `auto-generated-${Date.now()}-${i}`;

      const workflowResult = await forwardToService(
        env.NEXUS_WORKFLOW,
        "/workflow/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain_id: schedule.domain_id,
            category_id: categoryId,
            niche,
            language: schedule.language ?? "en",
            platforms,
            social_channels: socialChannels,
            social_enabled: socialChannels.length > 0,
            posting_mode: "auto",
            price_suggestion: "ai",
            target_audience: "ai",
            design_style: "ai",
            batch_count: 1,
            auto_approve_threshold: schedule.auto_approve_threshold,
            auto_revise_min_score: schedule.auto_revise_min_score,
            max_auto_revisions: schedule.max_auto_revisions,
          }),
        }
      );

      if (workflowResult.success) {
        productsCreated++;
      } else {
        productsFailed++;
      }
    }

    // Update schedule with next run time and totals
    const nextRunAt = new Date(
      Date.now() + (schedule.interval_hours ?? 24) * 3600000
    ).toISOString();

    await storageQuery(
      env,
      `UPDATE schedules SET last_run_at = ?, next_run_at = ?,
         total_products_created = total_products_created + ?, updated_at = ?
       WHERE id = ?`,
      [ts, nextRunAt, productsCreated, now(), schedule.id]
    );

    // Update schedule run
    await storageQuery(
      env,
      `UPDATE schedule_runs SET status = 'completed', products_created = ?, products_failed = ?, completed_at = ?
       WHERE id = ?`,
      [productsCreated, productsFailed, now(), runId]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Update schedule run with error
    await storageQuery(
      env,
      `UPDATE schedule_runs SET status = 'failed', products_created = ?, products_failed = ?, error = ?, completed_at = ?
       WHERE id = ?`,
      [productsCreated, productsFailed, message, now(), runId]
    );

    // Still update the next_run_at so we don't keep retrying immediately
    const nextRunAt = new Date(
      Date.now() + (schedule.interval_hours ?? 24) * 3600000
    ).toISOString();

    await storageQuery(
      env,
      `UPDATE schedules SET next_run_at = ?, updated_at = ? WHERE id = ?`,
      [nextRunAt, now(), schedule.id]
    );

    throw err;
  }

  return { products_created: productsCreated };
}
