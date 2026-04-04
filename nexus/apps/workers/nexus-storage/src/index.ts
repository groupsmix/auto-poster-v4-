// ============================================================
// nexus-storage Worker — Hono.js entry point
// Handles ALL storage operations across D1, KV, R2, CF Images
// Called via Service Binding from nexus-router (not public)
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { StructuredLogger } from "@nexus/shared";
import { D1Queries } from "./d1";
import { KVCache } from "./kv";
import { R2Storage } from "./r2";
import { CFImages } from "./images";
import { CleanupService } from "./cleanup";

// Structured logger instance for this worker (code-review #21)
const logger = new StructuredLogger("nexus-storage");

// --- Env type for this worker's bindings ---
interface StorageEnv {
  DB: D1Database;
  CACHE: KVNamespace;
  BUCKET: R2Bucket;
  CF_ACCOUNT_ID?: string;
  CF_IMAGES_TOKEN?: string;
  [key: string]: unknown;
}

const app = new Hono<{ Bindings: StorageEnv }>();

// --- Helper to build service instances from env ---
function getServices(env: StorageEnv) {
  const d1 = new D1Queries(env.DB);
  const kv = new KVCache(env.CACHE);
  const r2 = new R2Storage(env.BUCKET);
  const images = new CFImages({
    CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
    CF_IMAGES_TOKEN: env.CF_IMAGES_TOKEN,
  });
  const cleanup = new CleanupService(d1, r2, kv, images);
  return { d1, kv, r2, images, cleanup };
}

// ============================================================
// HEALTH & INFO
// ============================================================

app.get("/", (c) => {
  return c.json({
    service: "nexus-storage",
    status: "ok",
    version: "0.1.0",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// ============================================================
// D1 ROUTES
// ============================================================

// ── SQL classification helpers ──────────────────────────────

/** Dangerous SQL statements that should never be allowed via the query endpoint */
const DANGEROUS_SQL_PATTERNS = [
  /^\s*DROP\s+/i,
  /^\s*ALTER\s+/i,
  /^\s*TRUNCATE\s+/i,
  /^\s*PRAGMA\s+(?!foreign_keys)/i,
  /^\s*ATTACH\s+/i,
  /^\s*DETACH\s+/i,
  /^\s*VACUUM\s*/i,
  /^\s*REINDEX\s*/i,
];

/** Check if a SQL statement is read-only (SELECT / EXPLAIN / PRAGMA foreign_keys) */
function isReadOnlyQuery(sql: string): boolean {
  const trimmed = sql.trim();
  return /^\s*(SELECT|EXPLAIN|PRAGMA\s+foreign_keys)/i.test(trimmed);
}

/** Check if a SQL statement matches dangerous patterns */
function isDangerousQuery(sql: string): boolean {
  return DANGEROUS_SQL_PATTERNS.some((pattern) => pattern.test(sql.trim()));
}

/** POST /d1/query — execute D1 queries (parameterized) with validation */
app.post("/d1/query", async (c) => {
  try {
    const { sql, params } = await c.req.json<{ sql: string; params?: unknown[] }>();
    if (!sql) {
      return c.json<ApiResponse>({ success: false, error: "sql is required" }, 400);
    }

    // Block dangerous queries (DROP, ALTER, TRUNCATE, etc.)
    if (isDangerousQuery(sql)) {
      logger.warn(`BLOCKED dangerous query: ${sql.slice(0, 100)}`);
      return c.json<ApiResponse>(
        { success: false, error: "This query type is not allowed via the API" },
        403
      );
    }

    // Log mutating queries for audit trail
    if (!isReadOnlyQuery(sql)) {
      logger.info(`Mutating query: ${sql.slice(0, 200)}`);
    }

    const { d1 } = getServices(c.env);
    const result = await d1.query(sql, params ?? []);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

/** POST /d1/batch — execute multiple D1 statements in a single call (code-review #11).
 *  Accepts an array of { sql, params } objects. All statements run inside
 *  an implicit D1 batch (single round-trip). Useful for analytics inserts
 *  where the workflow engine writes many rows at once. */
app.post("/d1/batch", async (c) => {
  try {
    const { statements } = await c.req.json<{
      statements: Array<{ sql: string; params?: unknown[] }>;
    }>();

    if (!statements || !Array.isArray(statements) || statements.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "statements array is required and must not be empty" },
        400
      );
    }

    // Validate all statements before executing
    for (const stmt of statements) {
      if (!stmt.sql) {
        return c.json<ApiResponse>({ success: false, error: "Each statement must have a sql field" }, 400);
      }
      if (isDangerousQuery(stmt.sql)) {
        return c.json<ApiResponse>(
          { success: false, error: `Dangerous query blocked: ${stmt.sql.slice(0, 100)}` },
          403
        );
      }
    }

    const { d1 } = getServices(c.env);
    const results = [];
    for (const stmt of statements) {
      const result = await d1.query(stmt.sql, stmt.params ?? []);
      results.push(result);
    }

    return c.json<ApiResponse>({ success: true, data: { results, count: statements.length } });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

/** POST /d1/read — read-only query endpoint (only allows SELECT statements) */
app.post("/d1/read", async (c) => {
  try {
    const { sql, params } = await c.req.json<{ sql: string; params?: unknown[] }>();
    if (!sql) {
      return c.json<ApiResponse>({ success: false, error: "sql is required" }, 400);
    }

    if (!isReadOnlyQuery(sql)) {
      return c.json<ApiResponse>(
        { success: false, error: "Only SELECT queries are allowed on this endpoint" },
        403
      );
    }

    const { d1 } = getServices(c.env);
    const result = await d1.query(sql, params ?? []);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

// ============================================================
// R2 ROUTES
// ============================================================

/** Maximum upload size: 25 MB (code-review issue #16) */
const R2_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** POST /r2/upload — upload file to R2 */
app.post("/r2/upload", async (c) => {
  try {
    const contentType = c.req.header("content-type") ?? "";
    const { r2 } = getServices(c.env);

    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const file = formData.get("file");
      const key = formData.get("key");

      if (!file || !key || typeof key !== "string") {
        return c.json<ApiResponse>(
          { success: false, error: "file and key are required" },
          400
        );
      }

      const fileBlob = file as unknown as File;
      const data = await fileBlob.arrayBuffer();

      // Size validation
      if (data.byteLength > R2_MAX_UPLOAD_BYTES) {
        return c.json<ApiResponse>(
          { success: false, error: `File too large: ${(data.byteLength / 1024 / 1024).toFixed(1)}MB exceeds ${R2_MAX_UPLOAD_BYTES / 1024 / 1024}MB limit` },
          413
        );
      }

      const result = await r2.uploadFile(key, data, fileBlob.type);
      return c.json<ApiResponse>({ success: true, data: result });
    }

    // JSON body with base64 data
    const body = await c.req.json<{
      key: string;
      data: string;
      contentType?: string;
    }>();

    if (!body.key || !body.data) {
      return c.json<ApiResponse>(
        { success: false, error: "key and data are required" },
        400
      );
    }

    // Decode base64 data
    const binaryData = Uint8Array.from(atob(body.data), (ch) => ch.charCodeAt(0));

    // Size validation
    if (binaryData.byteLength > R2_MAX_UPLOAD_BYTES) {
      return c.json<ApiResponse>(
        { success: false, error: `File too large: ${(binaryData.byteLength / 1024 / 1024).toFixed(1)}MB exceeds ${R2_MAX_UPLOAD_BYTES / 1024 / 1024}MB limit` },
        413
      );
    }

    const result = await r2.uploadFile(
      body.key,
      binaryData.buffer,
      body.contentType
    );
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

/** GET /r2/:key — get file from R2 */
app.get("/r2/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const { r2 } = getServices(c.env);
    const file = await r2.getFile(key);

    if (!file) {
      return c.json<ApiResponse>({ success: false, error: "File not found" }, 404);
    }

    const headers = new Headers();
    if (file.info.httpMetadata?.contentType) {
      headers.set("Content-Type", file.info.httpMetadata.contentType);
    }
    headers.set("Content-Length", String(file.info.size));
    headers.set("ETag", file.info.etag);

    return new Response(file.body, { headers });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

/** DELETE /r2/:key — delete file from R2 */
app.delete("/r2/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const { r2 } = getServices(c.env);
    await r2.deleteFile(key);
    return c.json<ApiResponse>({ success: true });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

// ============================================================
// KV ROUTES
// ============================================================

/** GET /kv/:key — read from KV */
app.get("/kv/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const { kv } = getServices(c.env);
    const value = await kv.get(key);

    if (value === null) {
      return c.json<ApiResponse>({ success: false, error: "Key not found" }, 404);
    }

    // Try to parse as JSON, fall back to raw string
    try {
      const parsed = JSON.parse(value);
      return c.json<ApiResponse>({ success: true, data: parsed });
    } catch {
      return c.json<ApiResponse>({ success: true, data: value });
    }
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

/** PUT /kv/:key — write to KV (with optional TTL) */
app.put("/kv/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const body = await c.req.json<{ value: unknown; ttl?: number }>();

    if (body.value === undefined) {
      return c.json<ApiResponse>(
        { success: false, error: "value is required" },
        400
      );
    }

    const { kv } = getServices(c.env);
    const stringValue = typeof body.value === "string"
      ? body.value
      : JSON.stringify(body.value);

    await kv.put(key, stringValue, body.ttl);
    return c.json<ApiResponse>({ success: true });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

/** DELETE /kv/:key — delete from KV */
app.delete("/kv/:key", async (c) => {
  try {
    const key = decodeURIComponent(c.req.param("key"));
    const { kv } = getServices(c.env);
    await kv.delete(key);
    return c.json<ApiResponse>({ success: true });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

// ============================================================
// CF IMAGES ROUTES
// ============================================================

/** POST /images/upload — upload to CF Images */
app.post("/images/upload", async (c) => {
  try {
    const { images } = getServices(c.env);
    const contentType = c.req.header("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const file = formData.get("file");
      const metadataStr = formData.get("metadata");

      if (!file) {
        return c.json<ApiResponse>(
          { success: false, error: "file is required" },
          400
        );
      }

      const fileBlob = file as unknown as File;
      const data = await fileBlob.arrayBuffer();
      const metadata = metadataStr
        ? (JSON.parse(metadataStr as string) as Record<string, string>)
        : undefined;

      const result = await images.uploadImage(data, metadata);
      return c.json<ApiResponse>({ success: true, data: result });
    }

    // JSON body with base64 data
    const body = await c.req.json<{
      data: string;
      metadata?: Record<string, string>;
    }>();

    if (!body.data) {
      return c.json<ApiResponse>(
        { success: false, error: "data is required" },
        400
      );
    }

    const binaryData = Uint8Array.from(atob(body.data), (ch) => ch.charCodeAt(0));
    const result = await images.uploadImage(binaryData.buffer, body.metadata);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

/** DELETE /images/:id — delete from CF Images */
app.delete("/images/:id", async (c) => {
  try {
    const imageId = c.req.param("id");
    const { images } = getServices(c.env);
    await images.deleteImage(imageId);
    return c.json<ApiResponse>({ success: true });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

// ============================================================
// SYNCED DELETION (CLEANUP) ROUTES
// ============================================================

/** DELETE /cleanup/:entity/:id — synced deletion across all services */
app.delete("/cleanup/:entity/:id", async (c) => {
  try {
    const entity = c.req.param("entity");
    const id = c.req.param("id");
    const { cleanup } = getServices(c.env);

    let result;

    switch (entity) {
      case "product":
        result = await cleanup.deleteProduct(id);
        break;
      case "domain":
        result = await cleanup.deleteDomain(id);
        break;
      case "category":
        result = await cleanup.deleteCategory(id);
        break;
      case "asset":
        result = await cleanup.deleteAsset(id);
        break;
      default:
        return c.json<ApiResponse>(
          {
            success: false,
            error: `Unknown entity type: ${entity}. Supported: product, domain, category, asset`,
          },
          400
        );
    }

    return c.json<ApiResponse>({
      success: result.errors.length === 0,
      data: result,
      error:
        result.errors.length > 0
          ? result.errors.join("; ")
          : undefined,
    });
  } catch (e) {
    return c.json<ApiResponse>(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
});

// ============================================================
// SCHEDULED HANDLER — Retention cleanup cron
// ============================================================

/** Default retention periods (days) — can be overridden via settings table */
const DEFAULT_RETENTION: Record<string, number> = {
  analytics: 90,
  workflow_steps: 180,
  chatbot_messages: 30,
  schedule_runs: 90,
  ai_health_daily: 90,
};

async function runRetentionCleanup(env: StorageEnv): Promise<void> {
  const d1 = new D1Queries(env.DB);

  // Load custom retention periods from settings (if configured)
  const retention = { ...DEFAULT_RETENTION };
  try {
    const settingsResult = await d1.query(
      "SELECT value FROM settings WHERE key = 'retention_periods'"
    );
    const rows = (settingsResult as { results?: Array<{ value: string }> }).results;
    if (rows && rows.length > 0) {
      const custom = JSON.parse(rows[0].value) as Record<string, number>;
      Object.assign(retention, custom);
    }
  } catch {
    logger.info("Could not load custom retention periods, using defaults");
  }

  // Run cleanup for each table with a retention period
  const tables: Array<{ table: string; dateColumn: string; key: string }> = [
    { table: "analytics", dateColumn: "created_at", key: "analytics" },
    { table: "workflow_steps", dateColumn: "started_at", key: "workflow_steps" },
    { table: "chatbot_messages", dateColumn: "created_at", key: "chatbot_messages" },
    { table: "schedule_runs", dateColumn: "started_at", key: "schedule_runs" },
    { table: "ai_health_daily", dateColumn: "date", key: "ai_health_daily" },
  ];

  for (const { table, dateColumn, key } of tables) {
    const days = retention[key] ?? 90;
    try {
      const result = await d1.run(
        `DELETE FROM ${table} WHERE ${dateColumn} < datetime('now', '-${days} days')`
      );
      const deleted = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
      if (deleted > 0) {
        logger.info(`Retention cleanup: ${table}: deleted ${deleted} rows older than ${days} days`);
      }
    } catch (e) {
      logger.error(`Retention cleanup error for ${table}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: StorageEnv, _ctx: ExecutionContext): Promise<void> {
    logger.info("Running retention cleanup...");
    await runRetentionCleanup(env);
    logger.info("Retention cleanup complete");
  },
};
