// ============================================================
// Integration Tests — nexus-storage Worker
// Tests: D1 CRUD, KV cache, R2 ops, synced deletion
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../apps/workers/nexus-storage/src/index";
import type { ApiResponse } from "@nexus/shared";
import {
  createMockD1,
  createMockKV,
  createMockR2,
  jsonResponse,
  type MockD1Database,
  type MockKVNamespace,
  type MockR2Bucket,
} from "../helpers/mocks";

/** Typed API response for test assertions (replaces Record<string, any>) */
interface TestApiResponse extends ApiResponse<Record<string, unknown>> {
  service?: string;
  status?: string;
}

function buildEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: createMockD1(),
    CACHE: createMockKV(),
    BUCKET: createMockR2(),
    CF_ACCOUNT_ID: "test-account",
    CF_IMAGES_TOKEN: "test-token",
    ...overrides,
  };
}

function makeRequest(
  path: string,
  init?: RequestInit
): Request {
  return new Request(`http://localhost${path}`, init);
}

// ============================================================
// HEALTH & INFO
// ============================================================

describe("nexus-storage: Health & Info", () => {
  it("GET / returns service info", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data).toHaveProperty("service", "nexus-storage");
    expect(data).toHaveProperty("status", "ok");
  });

  it("GET /health returns healthy", async () => {
    const env = buildEnv();
    const res = await app.fetch(makeRequest("/health"), env);
    expect(res.status).toBe(200);
    const data = await res.json() as TestApiResponse;
    expect(data).toHaveProperty("status", "healthy");
  });
});

// ============================================================
// D1 CRUD OPERATIONS
// ============================================================

describe("nexus-storage: D1 Query Route", () => {
  it("POST /d1/query executes SQL and returns results", async () => {
    const db = createMockD1();
    const mockResults = [{ id: "1", name: "Test Domain" }];
    db._statement.all.mockResolvedValue({
      results: mockResults,
      success: true,
      meta: { changes: 0, last_row_id: 0, rows_read: 1 },
    });
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "SELECT * FROM domains",
          params: [],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("POST /d1/query returns 400 when sql is missing", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("sql is required");
  });

  it("POST /d1/query with parameterized INSERT", async () => {
    const db = createMockD1();
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "INSERT INTO domains (id, name, slug) VALUES (?, ?, ?)",
          params: ["dom-1", "Test", "test"],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(db.prepare).toHaveBeenCalledWith(
      "INSERT INTO domains (id, name, slug) VALUES (?, ?, ?)"
    );
  });

  it("POST /d1/query with UPDATE returns success", async () => {
    const db = createMockD1();
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "UPDATE domains SET name = ? WHERE id = ?",
          params: ["Updated", "dom-1"],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("POST /d1/query with DELETE returns success", async () => {
    const db = createMockD1();
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "DELETE FROM domains WHERE id = ?",
          params: ["dom-1"],
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("POST /d1/query handles D1 errors gracefully", async () => {
    const db = createMockD1();
    db._statement.all.mockRejectedValue(new Error("D1 error"));
    db._statement.run.mockRejectedValue(new Error("D1 error"));
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: "SELECT * FROM nonexistent" }),
      }),
      env
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

// ============================================================
// KV CACHE OPERATIONS
// ============================================================

describe("nexus-storage: KV Routes", () => {
  it("PUT /kv/:key writes a value to KV", async () => {
    const kv = createMockKV();
    const env = buildEnv({ CACHE: kv });

    const res = await app.fetch(
      makeRequest("/kv/test-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "hello-world" }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(kv.put).toHaveBeenCalled();
  });

  it("GET /kv/:key reads a value from KV", async () => {
    const kv = createMockKV();
    // Pre-populate KV
    kv._store.set("test-key", '"cached-value"');
    const env = buildEnv({ CACHE: kv });

    const res = await app.fetch(makeRequest("/kv/test-key"), env);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBe("cached-value");
  });

  it("GET /kv/:key returns 404 for missing key", async () => {
    const kv = createMockKV();
    const env = buildEnv({ CACHE: kv });

    const res = await app.fetch(makeRequest("/kv/nonexistent"), env);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Key not found");
  });

  it("DELETE /kv/:key deletes from KV (invalidate)", async () => {
    const kv = createMockKV();
    kv._store.set("delete-me", "value");
    const env = buildEnv({ CACHE: kv });

    const res = await app.fetch(
      makeRequest("/kv/delete-me", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(kv.delete).toHaveBeenCalled();
  });

  it("PUT /kv/:key returns 400 when value is missing", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/kv/test-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("PUT /kv/:key stores JSON objects as strings", async () => {
    const kv = createMockKV();
    const env = buildEnv({ CACHE: kv });
    const obj = { nested: true, count: 42 };

    const res = await app.fetch(
      makeRequest("/kv/json-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: obj }),
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalled();
  });
});

// ============================================================
// R2 UPLOAD / DOWNLOAD / DELETE
// ============================================================

describe("nexus-storage: R2 Routes", () => {
  it("POST /r2/upload uploads a file via base64 JSON", async () => {
    const r2 = createMockR2();
    const env = buildEnv({ BUCKET: r2 });

    const base64Data = btoa("Hello R2 World");

    const res = await app.fetch(
      makeRequest("/r2/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "test-file.txt",
          data: base64Data,
          contentType: "text/plain",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("POST /r2/upload returns 400 when key or data is missing", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/r2/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "test.txt" }), // missing data
      }),
      env
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("GET /r2/:key retrieves file from R2", async () => {
    const r2 = createMockR2();
    // Pre-upload
    const content = new TextEncoder().encode("file content");
    r2._objects.set("my-file.txt", {
      body: content.buffer,
      metadata: {},
    });
    const env = buildEnv({ BUCKET: r2 });

    const res = await app.fetch(makeRequest("/r2/my-file.txt"), env);
    // The route returns the file body or JSON with success
    expect(res.status).toBe(200);
  });

  it("GET /r2/:key returns 404 for missing file", async () => {
    const r2 = createMockR2();
    const env = buildEnv({ BUCKET: r2 });

    const res = await app.fetch(makeRequest("/r2/nonexistent.txt"), env);
    expect(res.status).toBe(404);
  });

  it("DELETE /r2/:key deletes file from R2", async () => {
    const r2 = createMockR2();
    r2._objects.set("delete-me.txt", {
      body: new ArrayBuffer(0),
    });
    const env = buildEnv({ BUCKET: r2 });

    const res = await app.fetch(
      makeRequest("/r2/delete-me.txt", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(r2.delete).toHaveBeenCalled();
  });
});

// ============================================================
// SYNCED DELETION (CLEANUP)
// ============================================================

describe("nexus-storage: Synced Deletion / Cleanup", () => {
  it("DELETE /cleanup/product/:id cleans up all services", async () => {
    const db = createMockD1();
    // Mock the query to return product data for cleanup
    db._statement.all.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0, last_row_id: 0, rows_read: 0 },
    });
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 0, rows_read: 0 },
    });
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/cleanup/product/prod-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    // Cleanup returns result data with deletion counts
    expect(json).toHaveProperty("data");
  });

  it("DELETE /cleanup/domain/:id cleans up domain", async () => {
    const db = createMockD1();
    db._statement.all.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0, last_row_id: 0, rows_read: 0 },
    });
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 0, rows_read: 0 },
    });
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/cleanup/domain/dom-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");
  });

  it("DELETE /cleanup/category/:id cleans up category", async () => {
    const db = createMockD1();
    db._statement.all.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0, last_row_id: 0, rows_read: 0 },
    });
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 0, rows_read: 0 },
    });
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/cleanup/category/cat-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
  });

  it("DELETE /cleanup/asset/:id cleans up asset", async () => {
    const db = createMockD1();
    db._statement.all.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0, last_row_id: 0, rows_read: 0 },
    });
    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 0, rows_read: 0 },
    });
    const env = buildEnv({ DB: db });

    const res = await app.fetch(
      makeRequest("/cleanup/asset/asset-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
  });

  it("DELETE /cleanup/unknown/:id returns 400 for unknown entity", async () => {
    const env = buildEnv();
    const res = await app.fetch(
      makeRequest("/cleanup/unknown/id-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Unknown entity type");
  });
});

// ============================================================
// [7.2] SYNCED DELETION CASCADE — Deep verification
// Tests that domain/category deletion cascades through all
// child records, R2 objects, KV entries, and CF Images
// ============================================================

describe("nexus-storage: Synced Deletion Cascade", () => {
  it("domain deletion cascades to products and cleans up R2 and CF Images", async () => {
    const db = createMockD1();
    const r2 = createMockR2();
    const kv = createMockKV();

    // Pre-populate R2 with product files
    const fileContent = new TextEncoder().encode("product image data");
    r2._objects.set("products/prod-1/images/img-1.png", { body: fileContent.buffer });
    r2._objects.set("products/prod-2/images/img-2.png", { body: fileContent.buffer });

    // Mock D1 to return product IDs and assets for the domain
    let queryCount = 0;
    db._statement.all.mockImplementation(async () => {
      queryCount++;
      // First query: getProductIdsByDomain → returns product IDs
      if (queryCount === 1) {
        return {
          results: [{ id: "prod-1" }, { id: "prod-2" }],
          success: true,
          meta: { changes: 0, last_row_id: 0, rows_read: 2 },
        };
      }
      // Second/third queries: getAssetsByProduct → returns assets with r2_key and cf_image_id
      if (queryCount === 2) {
        return {
          results: [{
            id: "asset-1",
            product_id: "prod-1",
            asset_type: "image",
            r2_key: "products/prod-1/images/img-1.png",
            cf_image_id: "cf-img-1",
            url: "/r2/products/prod-1/images/img-1.png",
            created_at: "2026-01-01T00:00:00Z",
          }],
          success: true,
          meta: { changes: 0, last_row_id: 0, rows_read: 1 },
        };
      }
      if (queryCount === 3) {
        return {
          results: [{
            id: "asset-2",
            product_id: "prod-2",
            asset_type: "image",
            r2_key: "products/prod-2/images/img-2.png",
            cf_image_id: "cf-img-2",
            url: "/r2/products/prod-2/images/img-2.png",
            created_at: "2026-01-01T00:00:00Z",
          }],
          success: true,
          meta: { changes: 0, last_row_id: 0, rows_read: 1 },
        };
      }
      // Remaining: empty results
      return {
        results: [],
        success: true,
        meta: { changes: 0, last_row_id: 0, rows_read: 0 },
      };
    });

    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 0, rows_read: 0 },
    });

    const env = buildEnv({ DB: db, BUCKET: r2, CACHE: kv });

    const res = await app.fetch(
      makeRequest("/cleanup/domain/dom-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");

    // Verify D1 was queried for product IDs and assets
    expect(db.prepare).toHaveBeenCalled();
    // Verify R2 delete was called for product files
    expect(r2.delete).toHaveBeenCalled();
    // Verify KV delete was called for domain config
    expect(kv.delete).toHaveBeenCalled();
  });

  it("category deletion cascades to products and cleans up R2", async () => {
    const db = createMockD1();
    const r2 = createMockR2();
    const kv = createMockKV();

    // Pre-populate R2
    const fileContent = new TextEncoder().encode("category product file");
    r2._objects.set("products/prod-cat-1/files/doc.pdf", { body: fileContent.buffer });

    let queryCount = 0;
    db._statement.all.mockImplementation(async () => {
      queryCount++;
      if (queryCount === 1) {
        // getProductIdsByCategory
        return {
          results: [{ id: "prod-cat-1" }],
          success: true,
          meta: { changes: 0, last_row_id: 0, rows_read: 1 },
        };
      }
      if (queryCount === 2) {
        // getAssetsByProduct
        return {
          results: [{
            id: "asset-cat-1",
            product_id: "prod-cat-1",
            asset_type: "file",
            r2_key: "products/prod-cat-1/files/doc.pdf",
            cf_image_id: null,
            url: "/r2/products/prod-cat-1/files/doc.pdf",
            created_at: "2026-01-01T00:00:00Z",
          }],
          success: true,
          meta: { changes: 0, last_row_id: 0, rows_read: 1 },
        };
      }
      return {
        results: [],
        success: true,
        meta: { changes: 0, last_row_id: 0, rows_read: 0 },
      };
    });

    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 0, rows_read: 0 },
    });

    const env = buildEnv({ DB: db, BUCKET: r2, CACHE: kv });

    const res = await app.fetch(
      makeRequest("/cleanup/category/cat-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");

    // Verify cascade was triggered
    expect(db.prepare).toHaveBeenCalled();
    expect(r2.delete).toHaveBeenCalled();
    expect(kv.delete).toHaveBeenCalled();
  });

  it("product deletion cleans up associated R2 files and CF Images", async () => {
    const db = createMockD1();
    const r2 = createMockR2();

    // Pre-populate R2
    const fileContent = new TextEncoder().encode("product asset");
    r2._objects.set("products/prod-del-1/images/hero.png", { body: fileContent.buffer });

    let queryCount = 0;
    db._statement.all.mockImplementation(async () => {
      queryCount++;
      if (queryCount === 1) {
        // getAssetsByProduct
        return {
          results: [{
            id: "asset-del-1",
            product_id: "prod-del-1",
            asset_type: "image",
            r2_key: "products/prod-del-1/images/hero.png",
            cf_image_id: "cf-del-1",
            url: "/r2/products/prod-del-1/images/hero.png",
            created_at: "2026-01-01T00:00:00Z",
          }],
          success: true,
          meta: { changes: 0, last_row_id: 0, rows_read: 1 },
        };
      }
      return {
        results: [],
        success: true,
        meta: { changes: 0, last_row_id: 0, rows_read: 0 },
      };
    });

    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 0, rows_read: 0 },
    });

    const env = buildEnv({ DB: db, BUCKET: r2 });

    const res = await app.fetch(
      makeRequest("/cleanup/product/prod-del-1", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");

    // Verify R2 delete was invoked for the product's assets
    expect(r2.delete).toHaveBeenCalled();
    // Verify D1 delete was called
    expect(db.prepare).toHaveBeenCalled();
  });

  it("domain deletion with no products still succeeds", async () => {
    const db = createMockD1();
    const kv = createMockKV();

    // No products under this domain
    db._statement.all.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0, last_row_id: 0, rows_read: 0 },
    });

    db._statement.run.mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 0, rows_read: 0 },
    });

    const env = buildEnv({ DB: db, CACHE: kv });

    const res = await app.fetch(
      makeRequest("/cleanup/domain/dom-empty", { method: "DELETE" }),
      env
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");
  });
});
