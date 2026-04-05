#!/usr/bin/env npx tsx
// ============================================================
// D1 Database Restore Script
// Restores a D1 database from a JSON backup file.
//
// Usage:
//   npx tsx scripts/restore-d1.ts < backup.json
//   cat /tmp/d1-backup.json | npx tsx scripts/restore-d1.ts
//
// The backup JSON format matches the output of backup-d1.ts:
//   { "tables": { "table_name": [ {row}, ... ] }, "rowCounts": {...} }
//
// Tables are restored in dependency order (domains before products, etc.)
// Each table is cleared (DELETE) before inserting rows.
// ============================================================

// Tables in dependency order (parents before children)
const RESTORE_ORDER = [
  // Foundation tables (no foreign keys)
  "domains",
  "categories",
  "platforms",
  "social_channels",
  "ai_models",
  "prompt_templates",
  "prompt_versions",
  "settings",
  "ceo_configurations",
  "briefing_settings",

  // Products (depends on domains, categories)
  "products",

  // Workflow (depends on products)
  "workflow_runs",
  "workflow_steps",

  // Assets and variants (depends on products)
  "assets",
  "platform_variants",
  "social_variants",

  // Reviews (depends on products)
  "reviews",
  "revision_history",

  // Analytics
  "analytics",
  "ai_health_daily",

  // Schedules and campaigns
  "schedules",
  "schedule_runs",
  "campaigns",

  // Chatbot
  "chatbot_conversations",
  "chatbot_messages",

  // Revenue
  "revenue_connections",
  "revenue_records",

  // ROI
  "niche_costs",
  "roi_snapshots",
  "roi_reports",

  // Recycler
  "recycler_jobs",
  "recycler_variations",

  // Localization
  "localization_jobs",
  "localized_products",

  // Project builder
  "project_builds",
  "project_build_files",

  // Briefings
  "daily_briefings",
];

interface BackupData {
  timestamp: string;
  tables: Record<string, Record<string, unknown>[]>;
  rowCounts: Record<string, number>;
}

async function restoreTable(
  storageUrl: string,
  table: string,
  rows: Record<string, unknown>[],
  authToken?: string
): Promise<number> {
  if (rows.length === 0) return 0;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  // Clear existing data
  await fetch(`${storageUrl}/d1/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sql: `DELETE FROM ${table}`, params: [] }),
  });

  // Insert rows in batches of 50
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => "?").join(", ");
      const values = columns.map((col) => row[col]);

      const resp = await fetch(`${storageUrl}/d1/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sql: `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
          params: values,
        }),
      });

      const json = (await resp.json()) as { success: boolean; error?: string };
      if (json.success) {
        inserted++;
      } else {
        console.error(`  Failed to insert row in ${table}: ${json.error}`);
      }
    }
  }

  return inserted;
}

async function main(): Promise<void> {
  const storageUrl =
    process.env.NEXUS_STORAGE_URL ?? "http://localhost:8787";
  const authToken = process.env.DASHBOARD_SECRET;

  // Read backup from stdin
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    console.error("[RESTORE] No input received. Pipe a backup JSON file.");
    process.exit(1);
  }

  const backup: BackupData = JSON.parse(input);

  console.error(`[RESTORE] Starting D1 restore from backup dated ${backup.timestamp}`);
  console.error(`[RESTORE] Tables in backup: ${Object.keys(backup.tables).length}`);

  let totalRestored = 0;

  for (const table of RESTORE_ORDER) {
    const rows = backup.tables[table];
    if (!rows || rows.length === 0) {
      console.error(`[RESTORE] ${table}: skipped (no data)`);
      continue;
    }

    try {
      const count = await restoreTable(storageUrl, table, rows, authToken);
      totalRestored += count;
      console.error(`[RESTORE] ${table}: ${count}/${rows.length} rows restored`);
    } catch (err) {
      console.error(
        `[RESTORE] Error restoring ${table}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Also restore any tables in backup that aren't in RESTORE_ORDER
  for (const table of Object.keys(backup.tables)) {
    if (RESTORE_ORDER.includes(table)) continue;
    const rows = backup.tables[table];
    if (!rows || rows.length === 0) continue;

    try {
      const count = await restoreTable(storageUrl, table, rows, authToken);
      totalRestored += count;
      console.error(`[RESTORE] ${table}: ${count}/${rows.length} rows restored (extra table)`);
    } catch (err) {
      console.error(`[RESTORE] Error restoring ${table}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.error(`[RESTORE] Complete. ${totalRestored} total rows restored.`);
}

main().catch((err) => {
  console.error("[RESTORE] Fatal error:", err);
  process.exit(1);
});
