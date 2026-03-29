// ============================================================
// nexus-storage Worker — Hono.js entry point
// Handles ALL storage operations across D1, KV, R2, CF Images
// Called via Service Binding from nexus-router (not public)
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { D1Queries } from "./d1";
import { KVCache } from "./kv";
import { R2Storage } from "./r2";
import { CFImages } from "./images";
import { CleanupService } from "./cleanup";

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

/** POST /d1/query — execute arbitrary D1 queries (parameterized) */
app.post("/d1/query", async (c) => {
  try {
    const { sql, params } = await c.req.json<{ sql: string; params?: unknown[] }>();
    if (!sql) {
      return c.json<ApiResponse>({ success: false, error: "sql is required" }, 400);
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

export default app;
