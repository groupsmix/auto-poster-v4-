/**
 * NEXUS Prompt Seeder
 *
 * Reads all prompt template files from the prompts/ directory and:
 * 1. Inserts them into D1 prompt_templates table with correct layer, target_id, name
 * 2. Writes them to KV for fast reads (prompts are read-heavy, rarely written)
 *
 * Run via: npx tsx scripts/seed-prompts.ts
 *
 * Environment variables required:
 *   CLOUDFLARE_ACCOUNT_ID  — Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN   — API token with D1 + KV permissions
 *   D1_DATABASE_ID         — D1 database ID
 *   KV_NAMESPACE_ID        — KV namespace ID
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptEntry {
  id: string;
  layer: string;
  target_id: string | null;
  name: string;
  prompt: string;
  version: number;
  is_active: boolean;
}

interface CloudflareD1Response {
  success: boolean;
  errors: Array<{ message: string }>;
  result: Array<{ results: unknown[] }>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROMPTS_DIR = path.resolve(__dirname, "../prompts");

const LAYER_DIRS: Record<string, string> = {
  roles: "role",
  domains: "domain",
  categories: "category",
  platforms: "platform",
  social: "social",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(layer: string, name: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${layer}:${name}`)
    .digest("hex")
    .slice(0, 12);
  return `prompt_${layer}_${hash}`;
}

function fileNameToTargetId(fileName: string): string {
  return fileName.replace(/\.txt$/, "");
}

function fileNameToDisplayName(fileName: string): string {
  return fileName
    .replace(/\.txt$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function readPromptFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8").trim();
}

// ---------------------------------------------------------------------------
// Prompt Discovery
// ---------------------------------------------------------------------------

function discoverPrompts(): PromptEntry[] {
  const entries: PromptEntry[] = [];

  // Layer A: Master prompt (single file)
  const masterPath = path.join(PROMPTS_DIR, "master.txt");
  if (fs.existsSync(masterPath)) {
    entries.push({
      id: generateId("master", "master"),
      layer: "master",
      target_id: null,
      name: "Master System Prompt",
      prompt: readPromptFile(masterPath),
      version: 1,
      is_active: true,
    });
  }

  // Layer B-F: Directory-based prompts (roles, domains, categories, platforms, social)
  for (const [dir, layer] of Object.entries(LAYER_DIRS)) {
    const dirPath = path.join(PROMPTS_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".txt"));
    for (const file of files) {
      const targetId = fileNameToTargetId(file);
      const displayName = fileNameToDisplayName(file);
      entries.push({
        id: generateId(layer, targetId),
        layer,
        target_id: targetId,
        name: displayName,
        prompt: readPromptFile(path.join(dirPath, file)),
        version: 1,
        is_active: true,
      });
    }
  }

  // CEO Review prompt (single file)
  const reviewPath = path.join(PROMPTS_DIR, "review.txt");
  if (fs.existsSync(reviewPath)) {
    entries.push({
      id: generateId("review", "ceo-review"),
      layer: "review",
      target_id: null,
      name: "CEO Review Prompt",
      prompt: readPromptFile(reviewPath),
      version: 1,
      is_active: true,
    });
  }

  // Context injection template (single file)
  const contextPath = path.join(PROMPTS_DIR, "context.txt");
  if (fs.existsSync(contextPath)) {
    entries.push({
      id: generateId("context", "context-injection"),
      layer: "context",
      target_id: null,
      name: "Context Injection Template",
      prompt: readPromptFile(contextPath),
      version: 1,
      is_active: true,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Cloudflare D1 Seeder
// ---------------------------------------------------------------------------

async function seedD1(entries: PromptEntry[]): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.D1_DATABASE_ID;

  if (!accountId || !apiToken || !databaseId) {
    console.log("[D1] Skipping D1 seed — missing environment variables:");
    if (!accountId) console.log("  - CLOUDFLARE_ACCOUNT_ID");
    if (!apiToken) console.log("  - CLOUDFLARE_API_TOKEN");
    if (!databaseId) console.log("  - D1_DATABASE_ID");
    return;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  // Build batch SQL statements
  const statements = entries.map((entry) => ({
    sql: `INSERT OR REPLACE INTO prompt_templates (id, layer, target_id, name, prompt, version, is_active, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    params: [
      entry.id,
      entry.layer,
      entry.target_id,
      entry.name,
      entry.prompt,
      entry.version,
      entry.is_active ? 1 : 0,
    ],
  }));

  // D1 HTTP API supports batched queries
  const batchSize = 25;
  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, i + batchSize);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    const result = (await response.json()) as CloudflareD1Response;
    if (!result.success) {
      console.error(
        `[D1] Batch ${Math.floor(i / batchSize) + 1} failed:`,
        result.errors
      );
    } else {
      console.log(
        `[D1] Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} prompts seeded`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Cloudflare KV Seeder
// ---------------------------------------------------------------------------

async function seedKV(entries: PromptEntry[]): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const namespaceId = process.env.KV_NAMESPACE_ID;

  if (!accountId || !apiToken || !namespaceId) {
    console.log("[KV] Skipping KV seed — missing environment variables:");
    if (!accountId) console.log("  - CLOUDFLARE_ACCOUNT_ID");
    if (!apiToken) console.log("  - CLOUDFLARE_API_TOKEN");
    if (!namespaceId) console.log("  - KV_NAMESPACE_ID");
    return;
  }

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;

  // KV bulk write API accepts up to 10,000 pairs
  const kvPairs = entries.map((entry) => {
    // KV key format: prompt:{layer}:{target_id || "global"}
    const keyParts = ["prompt", entry.layer];
    if (entry.target_id) {
      keyParts.push(entry.target_id);
    } else {
      keyParts.push("global");
    }
    const key = keyParts.join(":");

    return {
      key,
      value: JSON.stringify({
        id: entry.id,
        layer: entry.layer,
        target_id: entry.target_id,
        name: entry.name,
        prompt: entry.prompt,
        version: entry.version,
        is_active: entry.is_active,
      }),
    };
  });

  const response = await fetch(`${baseUrl}/bulk`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(kvPairs),
  });

  const result = (await response.json()) as { success: boolean; errors: Array<{ message: string }> };
  if (!result.success) {
    console.error("[KV] Bulk write failed:", result.errors);
  } else {
    console.log(`[KV] ${kvPairs.length} prompts written to KV`);
  }

  // Also write an index of all prompt keys for fast lookups
  const indexResponse = await fetch(
    `${baseUrl}/values/prompt:index`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        kvPairs.map((p) => ({
          key: p.key,
          layer: entries.find((e) => p.key.includes(e.layer))?.layer,
          name: entries.find((e) => p.key.includes(e.target_id || "global"))?.name,
        }))
      ),
    }
  );

  const indexResult = (await indexResponse.json()) as { success: boolean };
  if (indexResult.success) {
    console.log("[KV] Prompt index written");
  }
}

// ---------------------------------------------------------------------------
// Local preview (dry run)
// ---------------------------------------------------------------------------

function printSummary(entries: PromptEntry[]): void {
  console.log("\n=== NEXUS Prompt Seed Summary ===\n");

  const byLayer = new Map<string, PromptEntry[]>();
  for (const entry of entries) {
    const list = byLayer.get(entry.layer) || [];
    list.push(entry);
    byLayer.set(entry.layer, list);
  }

  const layerOrder = [
    "master",
    "role",
    "domain",
    "category",
    "platform",
    "social",
    "review",
    "context",
  ];

  for (const layer of layerOrder) {
    const items = byLayer.get(layer);
    if (!items) continue;

    console.log(
      `Layer: ${layer.toUpperCase()} (${items.length} prompt${items.length > 1 ? "s" : ""})`
    );
    for (const item of items) {
      const target = item.target_id ? ` [${item.target_id}]` : "";
      const preview = item.prompt.slice(0, 80).replace(/\n/g, " ");
      console.log(`  ${item.name}${target}`);
      console.log(`    ID: ${item.id}`);
      console.log(`    Preview: ${preview}...`);
      console.log(`    Length: ${item.prompt.length} chars`);
    }
    console.log();
  }

  console.log(`Total: ${entries.length} prompts discovered\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[NEXUS] Discovering prompt templates...\n");

  const entries = discoverPrompts();

  if (entries.length === 0) {
    console.error("[ERROR] No prompt files found in", PROMPTS_DIR);
    process.exit(1);
  }

  // Always print summary
  printSummary(entries);

  // Check if we should seed remotely
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[DRY RUN] Skipping D1 and KV writes. Use without --dry-run to seed.");
    return;
  }

  const hasCloudflareEnv =
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_API_TOKEN;

  if (!hasCloudflareEnv) {
    console.log(
      "[INFO] No Cloudflare credentials found. Showing local preview only."
    );
    console.log(
      "[INFO] Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID, and KV_NAMESPACE_ID to seed remotely."
    );
    return;
  }

  // Seed D1
  console.log("[D1] Seeding prompt_templates table...");
  await seedD1(entries);

  // Seed KV
  console.log("[KV] Writing prompts to KV...");
  await seedKV(entries);

  console.log("\n[NEXUS] Prompt seeding complete!");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
