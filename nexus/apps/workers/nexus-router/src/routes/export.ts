import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const exportRoutes = new Hono<{ Bindings: RouterEnv }>();

/**
 * Complete list of D1 tables (kept in sync with migrations & backup-d1.ts).
 * Using a constant array ensures new tables are never silently skipped.
 */
const ALL_TABLES = [
  // 001_initial_schema.sql
  "domains",
  "categories",
  "platforms",
  "social_channels",
  "products",
  "workflow_runs",
  "workflow_steps",
  "assets",
  "platform_variants",
  "social_variants",
  "reviews",
  "revision_history",
  "prompt_templates",
  "ai_models",
  "analytics",
  "settings",
  // 005_prompt_versioning.sql
  "prompt_versions",
  // 006_ceo_configurations.sql
  "ceo_configurations",
  // 007_schedules.sql
  "schedules",
  "schedule_runs",
  // 008_campaigns.sql
  "campaigns",
  // 009_chatbot.sql
  "chatbot_conversations",
  "chatbot_messages",
  // 010_revenue.sql
  "revenue_connections",
  "revenue_records",
  // 011_roi.sql
  "niche_costs",
  "roi_snapshots",
  "roi_reports",
  // 012_recycler.sql
  "recycler_jobs",
  "recycler_variations",
  // 013_localization.sql
  "localization_jobs",
  "localized_products",
  // 014_project_builder.sql
  "project_builds",
  "project_build_files",
  // AI health tracking
  "ai_health_daily",
  // Daily briefings
  "daily_briefings",
  "briefing_settings",
] as const;

/** Default and maximum row limit per table to prevent memory/timeout issues */
const DEFAULT_ROW_LIMIT = 5000;
const MAX_ROW_LIMIT = 50000;

// GET /api/export/full — dump all tables as JSON for backup (7.7)
// Supports query params:
//   ?tables=domains,products   — export only specific tables (default: all)
//   ?limit=1000                — max rows per table (default: 5000, max: 50000)
//   ?offset=0                  — row offset for pagination (default: 0)
exportRoutes.get("/full", async (c) => {
  try {
    // Parse optional filters
    const tablesParam = c.req.query("tables");
    const requestedTables = tablesParam
      ? tablesParam.split(",").map((t) => t.trim()).filter(Boolean)
      : [...ALL_TABLES];

    // Validate table names to prevent SQL injection
    const validTables = requestedTables.filter((t) =>
      (ALL_TABLES as readonly string[]).includes(t)
    );
    if (validTables.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: `No valid tables specified. Available: ${ALL_TABLES.join(", ")}` },
        400
      );
    }

    const limit = Math.min(
      Math.max(1, parseInt(c.req.query("limit") ?? String(DEFAULT_ROW_LIMIT), 10) || DEFAULT_ROW_LIMIT),
      MAX_ROW_LIMIT
    );
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);

    const results: Record<string, unknown> = {};
    const rowCounts: Record<string, number> = {};

    // Fetch tables in parallel with row limits
    const queries = validTables.map((table) =>
      storageQuery<Record<string, unknown>[]>(
        c.env,
        `SELECT * FROM ${table} LIMIT ? OFFSET ?`,
        [limit, offset]
      )
        .then((data) => {
          const rows = Array.isArray(data) ? data : [];
          return { table, data: rows, count: rows.length };
        })
        .catch(() => ({ table, data: [] as Record<string, unknown>[], count: 0 }))
    );

    const tableResults = await Promise.all(queries);
    for (const { table, data, count } of tableResults) {
      results[table] = data;
      rowCounts[table] = count;
    }

    return c.json<ApiResponse>({
      success: true,
      data: {
        exported_at: new Date().toISOString(),
        tables: results,
        row_counts: rowCounts,
        pagination: { limit, offset },
        total_tables: validTables.length,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default exportRoutes;
