#!/usr/bin/env npx tsx
// ============================================================
// D1 Database Backup Script
// Exports all D1 tables to a JSON file for safekeeping.
//
// Usage:
//   npx tsx scripts/backup-d1.ts
//
// Can also be invoked via a Cron Trigger (see nexus-storage
// wrangler.toml for scheduled handler).
//
// The script connects to nexus-storage's /d1/query endpoint
// to export each table and writes the result to stdout as JSON.
// Pipe to a file or upload to R2 for persistent backups.
// ============================================================

const TABLES = [
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
];

interface BackupResult {
  timestamp: string;
  tables: Record<string, unknown[]>;
  rowCounts: Record<string, number>;
}

async function exportTable(
  storageUrl: string,
  table: string,
  authToken?: string
): Promise<unknown[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const resp = await fetch(`${storageUrl}/d1/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sql: `SELECT * FROM ${table}`,
      params: [],
    }),
  });

  const json = (await resp.json()) as {
    success: boolean;
    data?: { results?: unknown[] };
    error?: string;
  };

  if (!json.success) {
    console.error(`Failed to export ${table}: ${json.error}`);
    return [];
  }

  return json.data?.results ?? [];
}

async function main(): Promise<void> {
  const storageUrl =
    process.env.NEXUS_STORAGE_URL ?? "http://localhost:8787";
  const authToken = process.env.DASHBOARD_SECRET;

  console.error(`[BACKUP] Starting D1 backup from ${storageUrl}`);
  console.error(`[BACKUP] Tables: ${TABLES.length}`);

  const backup: BackupResult = {
    timestamp: new Date().toISOString(),
    tables: {},
    rowCounts: {},
  };

  for (const table of TABLES) {
    try {
      const rows = await exportTable(storageUrl, table, authToken);
      backup.tables[table] = rows;
      backup.rowCounts[table] = rows.length;
      console.error(`[BACKUP] ${table}: ${rows.length} rows`);
    } catch (err) {
      console.error(
        `[BACKUP] Error exporting ${table}: ${err instanceof Error ? err.message : String(err)}`
      );
      backup.tables[table] = [];
      backup.rowCounts[table] = 0;
    }
  }

  // Output the backup as JSON to stdout
  console.log(JSON.stringify(backup, null, 2));

  const totalRows = Object.values(backup.rowCounts).reduce(
    (sum, n) => sum + n,
    0
  );
  console.error(
    `[BACKUP] Complete. ${totalRows} total rows across ${TABLES.length} tables.`
  );
}

main().catch((err) => {
  console.error("[BACKUP] Fatal error:", err);
  process.exit(1);
});
