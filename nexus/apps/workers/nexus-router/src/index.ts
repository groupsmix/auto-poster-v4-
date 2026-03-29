// ============================================================
// nexus-router Worker — Hono.js Entry Point
// The ONLY worker that receives external HTTP requests.
// All other workers are internal via Service Bindings.
//
// Routes: /api/domains, /api/categories, /api/products,
//         /api/workflow, /api/reviews, /api/publish,
//         /api/platforms, /api/social-channels, /api/prompts,
//         /api/ai, /api/assets, /api/analytics, /api/history,
//         /api/settings
// ============================================================

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, ApiResponse } from "@nexus/shared";
import { generateId, slugify, now } from "@nexus/shared";

// ── Router Env extends shared Env with DASHBOARD_SECRET ─────
interface RouterEnv extends Env {
  DASHBOARD_SECRET?: string;
}

const app = new Hono<{ Bindings: RouterEnv }>();

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS — allow dashboard origin
app.use("*", cors());

// Auth middleware — protects all /api/* routes
app.use("/api/*", async (c, next) => {
  const secret = c.env.DASHBOARD_SECRET;

  // If no secret is configured, skip auth (development mode)
  if (!secret) {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json<ApiResponse>(
      { success: false, error: "Missing Authorization header" },
      401
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== secret) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid authentication token" },
      401
    );
  }

  await next();
});

// ============================================================
// HELPERS
// ============================================================

/** Forward a fetch to nexus-storage for D1 queries */
async function storageQuery(
  env: RouterEnv,
  sql: string,
  params: unknown[] = []
): Promise<unknown> {
  const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const json = (await resp.json()) as ApiResponse;
  if (!json.success) {
    throw new Error(json.error ?? "Storage query failed");
  }
  return json.data;
}

/** Forward a fetch to nexus-storage for synced cleanup */
async function storageCleanup(
  env: RouterEnv,
  entity: string,
  id: string
): Promise<ApiResponse> {
  const resp = await env.NEXUS_STORAGE.fetch(
    `http://nexus-storage/cleanup/${entity}/${id}`,
    { method: "DELETE" }
  );
  return (await resp.json()) as ApiResponse;
}

/** Forward a request to a service binding worker and return its JSON response */
async function forwardToService(
  service: Fetcher,
  path: string,
  init?: RequestInit
): Promise<ApiResponse> {
  const resp = await service.fetch(`http://internal${path}`, init);
  return (await resp.json()) as ApiResponse;
}

/** Standard error response */
function errorResponse(
  c: { json: <T>(data: T, status?: number) => Response },
  err: unknown,
  status = 500
): Response {
  const message = err instanceof Error ? err.message : String(err);
  return c.json<ApiResponse>({ success: false, error: message }, status);
}

// ============================================================
// ROOT & HEALTH
// ============================================================

app.get("/", (c) => {
  return c.json({
    service: "nexus-router",
    status: "ok",
    version: "1.0.0",
    description: "NEXUS API Gateway — all routes prefixed with /api/",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// ============================================================
// DOMAINS & CATEGORIES
// ============================================================

// GET /api/domains — list all domains
app.get("/api/domains", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      "SELECT * FROM domains ORDER BY sort_order ASC"
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/domains — create domain
app.post("/api/domains", async (c) => {
  try {
    const body = await c.req.json<{
      name?: string;
      description?: string;
      icon?: string;
    }>();

    if (!body.name) {
      return c.json<ApiResponse>(
        { success: false, error: "name is required" },
        400
      );
    }

    const id = generateId();
    const slug = slugify(body.name);
    const ts = now();

    await storageQuery(
      c.env,
      `INSERT INTO domains (id, name, slug, description, icon, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM domains), 1, ?)`,
      [id, body.name, slug, body.description ?? null, body.icon ?? null, ts]
    );

    return c.json<ApiResponse>(
      { success: true, data: { id, name: body.name, slug } },
      201
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/domains/:id — update domain
app.put("/api/domains/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      description?: string;
      icon?: string;
      sort_order?: number;
      is_active?: boolean;
    }>();

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      sets.push("name = ?", "slug = ?");
      params.push(body.name, slugify(body.name));
    }
    if (body.description !== undefined) {
      sets.push("description = ?");
      params.push(body.description);
    }
    if (body.icon !== undefined) {
      sets.push("icon = ?");
      params.push(body.icon);
    }
    if (body.sort_order !== undefined) {
      sets.push("sort_order = ?");
      params.push(body.sort_order);
    }
    if (body.is_active !== undefined) {
      sets.push("is_active = ?");
      params.push(body.is_active ? 1 : 0);
    }

    if (sets.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No fields to update" },
        400
      );
    }

    params.push(id);
    await storageQuery(
      c.env,
      `UPDATE domains SET ${sets.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/domains/:id — delete domain (triggers synced cleanup)
app.delete("/api/domains/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await storageCleanup(c.env, "domain", id);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/domains/:id/categories — list categories for domain
app.get("/api/domains/:id/categories", async (c) => {
  try {
    const domainId = c.req.param("id");
    const data = await storageQuery(
      c.env,
      "SELECT * FROM categories WHERE domain_id = ? ORDER BY sort_order ASC",
      [domainId]
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/categories — create category
app.post("/api/categories", async (c) => {
  try {
    const body = await c.req.json<{
      domain_id?: string;
      name?: string;
      description?: string;
    }>();

    if (!body.domain_id || !body.name) {
      return c.json<ApiResponse>(
        { success: false, error: "domain_id and name are required" },
        400
      );
    }

    const id = generateId();
    const slug = slugify(body.name);

    await storageQuery(
      c.env,
      `INSERT INTO categories (id, domain_id, name, slug, description, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories WHERE domain_id = ?), 1)`,
      [id, body.domain_id, body.name, slug, body.description ?? null, body.domain_id]
    );

    return c.json<ApiResponse>(
      { success: true, data: { id, domain_id: body.domain_id, name: body.name, slug } },
      201
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/categories/:id — update category
app.put("/api/categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      description?: string;
      sort_order?: number;
      is_active?: boolean;
    }>();

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      sets.push("name = ?", "slug = ?");
      params.push(body.name, slugify(body.name));
    }
    if (body.description !== undefined) {
      sets.push("description = ?");
      params.push(body.description);
    }
    if (body.sort_order !== undefined) {
      sets.push("sort_order = ?");
      params.push(body.sort_order);
    }
    if (body.is_active !== undefined) {
      sets.push("is_active = ?");
      params.push(body.is_active ? 1 : 0);
    }

    if (sets.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No fields to update" },
        400
      );
    }

    params.push(id);
    await storageQuery(
      c.env,
      `UPDATE categories SET ${sets.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/categories/:id — delete category (triggers synced cleanup)
app.delete("/api/categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await storageCleanup(c.env, "category", id);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// PRODUCTS
// ============================================================

// GET /api/products — list all products (with filters)
app.get("/api/products", async (c) => {
  try {
    const domain = c.req.query("domain");
    const category = c.req.query("category");
    const status = c.req.query("status");
    const batch = c.req.query("batch");
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "50", 10);
    const offset = (page - 1) * pageSize;

    let where = "1=1";
    const params: unknown[] = [];

    if (domain) {
      where += " AND domain_id = ?";
      params.push(domain);
    }
    if (category) {
      where += " AND category_id = ?";
      params.push(category);
    }
    if (status) {
      where += " AND status = ?";
      params.push(status);
    }
    if (batch) {
      where += " AND batch_id = ?";
      params.push(batch);
    }

    const countResult = (await storageQuery(
      c.env,
      `SELECT COUNT(*) as total FROM products WHERE ${where}`,
      params
    )) as Array<{ total: number }>;

    const total = countResult?.[0]?.total ?? 0;

    const data = await storageQuery(
      c.env,
      `SELECT * FROM products WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return c.json({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/products/:id — get product detail + variants
app.get("/api/products/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const products = (await storageQuery(
      c.env,
      "SELECT * FROM products WHERE id = ?",
      [id]
    )) as Array<Record<string, unknown>>;

    if (!products || (products as unknown[]).length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Product not found" },
        404
      );
    }

    const product = products[0];

    // Fetch platform variants, social variants, and assets in parallel
    const [platformVariants, socialVariants, assets] = await Promise.all([
      storageQuery(
        c.env,
        "SELECT * FROM platform_variants WHERE product_id = ?",
        [id]
      ),
      storageQuery(
        c.env,
        "SELECT * FROM social_variants WHERE product_id = ?",
        [id]
      ),
      storageQuery(c.env, "SELECT * FROM assets WHERE product_id = ?", [id]),
    ]);

    return c.json<ApiResponse>({
      success: true,
      data: {
        ...product,
        platform_variants: platformVariants,
        social_variants: socialVariants,
        assets,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/products — create product draft
app.post("/api/products", async (c) => {
  try {
    const body = await c.req.json<{
      domain_id?: string;
      category_id?: string;
      name?: string;
      niche?: string;
      language?: string;
      description?: string;
      keywords?: string;
    }>();

    if (!body.domain_id || !body.category_id) {
      return c.json<ApiResponse>(
        { success: false, error: "domain_id and category_id are required" },
        400
      );
    }

    const id = generateId();
    const productName = body.name ?? body.niche ?? "Untitled";
    const slug = slugify(productName);
    const ts = now();

    await storageQuery(
      c.env,
      `INSERT INTO products (id, domain_id, category_id, name, slug, niche, language, status, user_input, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      [
        id,
        body.domain_id,
        body.category_id,
        productName,
        slug,
        body.niche ?? null,
        body.language ?? "en",
        JSON.stringify({
          description: body.description,
          keywords: body.keywords,
        }),
        ts,
        ts,
      ]
    );

    return c.json<ApiResponse>(
      {
        success: true,
        data: { id, name: productName, slug, status: "draft" },
      },
      201
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/products/:id — delete product (triggers synced cleanup)
app.delete("/api/products/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await storageCleanup(c.env, "product", id);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// WORKFLOWS — forwards to nexus-workflow
// ============================================================

// POST /api/workflow/start — start workflow (or batch)
app.post("/api/workflow/start", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.domain_id || !body.category_id || !body.niche) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "domain_id, category_id, and niche are required",
        },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      "/workflow/start",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 500);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/workflow/cancel/:runId — cancel workflow
app.post("/api/workflow/cancel/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "runId is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/cancel/${runId}`,
      { method: "POST" }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 500);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/workflow/status/:runId — get workflow status
app.get("/api/workflow/status/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "runId is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/status/${runId}`
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 404);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/workflow/batch/:batchId — get batch progress
app.get("/api/workflow/batch/:batchId", async (c) => {
  try {
    const batchId = c.req.param("batchId");

    if (!batchId) {
      return c.json<ApiResponse>(
        { success: false, error: "batchId is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/batch/${batchId}`
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 404);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/workflow/revise/:runId — revise with feedback
app.post("/api/workflow/revise/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");
    const body = await c.req.json<{ feedback?: string; steps?: string[] }>();

    if (!runId) {
      return c.json<ApiResponse>(
        { success: false, error: "runId is required" },
        400
      );
    }
    if (!body.feedback) {
      return c.json<ApiResponse>(
        { success: false, error: "feedback is required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_WORKFLOW,
      `/workflow/revise/${runId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 500);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// REVIEWS
// ============================================================

// GET /api/reviews/pending — list pending reviews
app.get("/api/reviews/pending", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT p.*, wr.id as run_id, wr.current_step, wr.total_steps,
              wr.total_tokens, wr.total_cost, wr.cache_hits
       FROM products p
       JOIN workflow_runs wr ON wr.product_id = p.id
       WHERE p.status = 'pending_review'
       ORDER BY p.updated_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/reviews/:productId — get review for product
app.get("/api/reviews/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");

    const data = await storageQuery(
      c.env,
      `SELECT r.*, p.name as product_name, p.status as product_status
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE r.product_id = ?
       ORDER BY r.version DESC`,
      [productId]
    );

    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/reviews/:productId/approve — approve product
app.post("/api/reviews/:productId/approve", async (c) => {
  try {
    const productId = c.req.param("productId");
    const ts = now();

    // Update product status
    await storageQuery(
      c.env,
      "UPDATE products SET status = 'approved', updated_at = ? WHERE id = ?",
      [ts, productId]
    );

    // Update workflow run status
    await storageQuery(
      c.env,
      `UPDATE workflow_runs SET status = 'approved', completed_at = ?
       WHERE product_id = ? AND status = 'pending_review'`,
      [ts, productId]
    );

    // Record the review decision
    const reviewId = generateId();
    await storageQuery(
      c.env,
      `INSERT INTO reviews (id, product_id, run_id, version, decision, reviewed_at)
       VALUES (?, ?, (SELECT id FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC LIMIT 1),
               (SELECT COALESCE(MAX(version), 0) + 1 FROM reviews WHERE product_id = ?),
               'approved', ?)`,
      [reviewId, productId, productId, productId, ts]
    );

    // Trigger platform variation + social content generation
    const products = (await storageQuery(
      c.env,
      "SELECT * FROM products WHERE id = ?",
      [productId]
    )) as Array<Record<string, unknown>>;

    if (products && (products as unknown[]).length > 0) {
      const product = products[0];
      const userInput =
        typeof product.user_input === "string"
          ? JSON.parse(product.user_input as string)
          : product.user_input ?? {};

      const baseProduct = {
        id: product.id,
        name: product.name,
        niche: product.niche,
        domain_id: product.domain_id,
        category_id: product.category_id,
      };

      // Generate platform variants if platforms specified
      const platforms: string[] = userInput.platforms ?? [];
      if (platforms.length > 0) {
        try {
          await forwardToService(
            c.env.NEXUS_VARIATION,
            "/variation/platforms",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseProduct,
                platformIds: platforms,
              }),
            }
          );
        } catch {
          console.error(
            "[ROUTER] Platform variation failed for",
            productId
          );
        }
      }

      // Generate social content if social enabled
      const socialChannels: string[] = userInput.social_channels ?? [];
      if (socialChannels.length > 0 && userInput.social_enabled) {
        try {
          await forwardToService(
            c.env.NEXUS_VARIATION,
            "/variation/socials",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseProduct,
                channelIds: socialChannels,
              }),
            }
          );
        } catch {
          console.error(
            "[ROUTER] Social variation failed for",
            productId
          );
        }
      }
    }

    return c.json<ApiResponse>({
      success: true,
      data: { product_id: productId, status: "approved" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/reviews/:productId/reject — reject with feedback
app.post("/api/reviews/:productId/reject", async (c) => {
  try {
    const productId = c.req.param("productId");
    const body = await c.req.json<{ feedback?: string }>();

    if (!body.feedback) {
      return c.json<ApiResponse>(
        { success: false, error: "feedback is required for rejection" },
        400
      );
    }

    const ts = now();

    // Update product status
    await storageQuery(
      c.env,
      "UPDATE products SET status = 'rejected', updated_at = ? WHERE id = ?",
      [ts, productId]
    );

    // Record the review decision
    const reviewId = generateId();
    await storageQuery(
      c.env,
      `INSERT INTO reviews (id, product_id, run_id, version, decision, feedback, reviewed_at)
       VALUES (?, ?, (SELECT id FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC LIMIT 1),
               (SELECT COALESCE(MAX(version), 0) + 1 FROM reviews WHERE product_id = ?),
               'rejected', ?, ?)`,
      [reviewId, productId, productId, productId, body.feedback, ts]
    );

    // Trigger revision via nexus-workflow
    const runResult = (await storageQuery(
      c.env,
      "SELECT id FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC LIMIT 1",
      [productId]
    )) as Array<{ id: string }>;

    if (runResult && (runResult as unknown[]).length > 0) {
      await forwardToService(
        c.env.NEXUS_WORKFLOW,
        `/workflow/revise/${runResult[0].id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: body.feedback }),
        }
      );
    }

    return c.json<ApiResponse>({
      success: true,
      data: { product_id: productId, status: "rejected" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// PUBLISHING
// ============================================================

// GET /api/publish/ready — list approved products ready to publish
app.get("/api/publish/ready", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT p.*,
              (SELECT COUNT(*) FROM platform_variants pv WHERE pv.product_id = p.id) as variant_count,
              (SELECT COUNT(*) FROM social_variants sv WHERE sv.product_id = p.id) as social_count
       FROM products p
       WHERE p.status = 'approved'
       ORDER BY p.updated_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/publish/:productId — publish to selected platforms
app.post("/api/publish/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");
    const body = await c.req.json<{
      platform_ids?: string[];
      channel_ids?: string[];
    }>();

    const ts = now();

    // Update product status to published
    await storageQuery(
      c.env,
      "UPDATE products SET status = 'published', updated_at = ? WHERE id = ?",
      [ts, productId]
    );

    // Update selected platform variants to published
    if (body.platform_ids && body.platform_ids.length > 0) {
      const placeholders = body.platform_ids.map(() => "?").join(", ");
      await storageQuery(
        c.env,
        `UPDATE platform_variants SET status = 'published', published_at = ?
         WHERE product_id = ? AND platform_id IN (${placeholders})`,
        [ts, productId, ...body.platform_ids]
      );
    }

    // Update selected social variants to published
    if (body.channel_ids && body.channel_ids.length > 0) {
      const placeholders = body.channel_ids.map(() => "?").join(", ");
      await storageQuery(
        c.env,
        `UPDATE social_variants SET status = 'published', published_at = ?
         WHERE product_id = ? AND channel_id IN (${placeholders})`,
        [ts, productId, ...body.channel_ids]
      );
    }

    // Update workflow run status
    await storageQuery(
      c.env,
      `UPDATE workflow_runs SET status = 'published'
       WHERE product_id = ? AND status = 'approved'`,
      [productId]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { product_id: productId, status: "published" },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/publish/:productId/export — export listings for manual copy
app.get("/api/publish/:productId/export", async (c) => {
  try {
    const productId = c.req.param("productId");

    const [product, platformVariants, socialVariants, assets] =
      await Promise.all([
        storageQuery(c.env, "SELECT * FROM products WHERE id = ?", [
          productId,
        ]),
        storageQuery(
          c.env,
          `SELECT pv.*, pl.name as platform_name, pl.slug as platform_slug
           FROM platform_variants pv
           JOIN platforms pl ON pl.id = pv.platform_id
           WHERE pv.product_id = ?`,
          [productId]
        ),
        storageQuery(
          c.env,
          `SELECT sv.*, sc.name as channel_name, sc.slug as channel_slug
           FROM social_variants sv
           JOIN social_channels sc ON sc.id = sv.channel_id
           WHERE sv.product_id = ?`,
          [productId]
        ),
        storageQuery(c.env, "SELECT * FROM assets WHERE product_id = ?", [
          productId,
        ]),
      ]);

    return c.json<ApiResponse>({
      success: true,
      data: {
        product,
        platform_listings: platformVariants,
        social_content: socialVariants,
        assets,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// PLATFORMS
// ============================================================

// GET /api/platforms — list all platforms
app.get("/api/platforms", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      "SELECT * FROM platforms ORDER BY name ASC"
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/platforms — create platform
app.post("/api/platforms", async (c) => {
  try {
    const body = await c.req.json<{
      name?: string;
      title_max_chars?: number;
      tag_count?: number;
      tag_max_chars?: number;
      audience?: string;
      tone?: string;
      seo_style?: string;
      description_style?: string;
      cta_style?: string;
      rules_json?: Record<string, unknown>;
    }>();

    if (!body.name) {
      return c.json<ApiResponse>(
        { success: false, error: "name is required" },
        400
      );
    }

    const id = generateId();
    const slug = slugify(body.name);

    await storageQuery(
      c.env,
      `INSERT INTO platforms (id, name, slug, title_max_chars, tag_count, tag_max_chars,
       audience, tone, seo_style, description_style, cta_style, rules_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        body.name,
        slug,
        body.title_max_chars ?? null,
        body.tag_count ?? null,
        body.tag_max_chars ?? null,
        body.audience ?? null,
        body.tone ?? null,
        body.seo_style ?? null,
        body.description_style ?? null,
        body.cta_style ?? null,
        body.rules_json ? JSON.stringify(body.rules_json) : null,
      ]
    );

    return c.json<ApiResponse>(
      { success: true, data: { id, name: body.name, slug } },
      201
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/platforms/:id — update platform rules
app.put("/api/platforms/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      title_max_chars?: number;
      tag_count?: number;
      tag_max_chars?: number;
      audience?: string;
      tone?: string;
      seo_style?: string;
      description_style?: string;
      cta_style?: string;
      rules_json?: Record<string, unknown>;
      is_active?: boolean;
    }>();

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      sets.push("name = ?", "slug = ?");
      params.push(body.name, slugify(body.name));
    }
    if (body.title_max_chars !== undefined) {
      sets.push("title_max_chars = ?");
      params.push(body.title_max_chars);
    }
    if (body.tag_count !== undefined) {
      sets.push("tag_count = ?");
      params.push(body.tag_count);
    }
    if (body.tag_max_chars !== undefined) {
      sets.push("tag_max_chars = ?");
      params.push(body.tag_max_chars);
    }
    if (body.audience !== undefined) {
      sets.push("audience = ?");
      params.push(body.audience);
    }
    if (body.tone !== undefined) {
      sets.push("tone = ?");
      params.push(body.tone);
    }
    if (body.seo_style !== undefined) {
      sets.push("seo_style = ?");
      params.push(body.seo_style);
    }
    if (body.description_style !== undefined) {
      sets.push("description_style = ?");
      params.push(body.description_style);
    }
    if (body.cta_style !== undefined) {
      sets.push("cta_style = ?");
      params.push(body.cta_style);
    }
    if (body.rules_json !== undefined) {
      sets.push("rules_json = ?");
      params.push(JSON.stringify(body.rules_json));
    }
    if (body.is_active !== undefined) {
      sets.push("is_active = ?");
      params.push(body.is_active ? 1 : 0);
    }

    if (sets.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No fields to update" },
        400
      );
    }

    params.push(id);
    await storageQuery(
      c.env,
      `UPDATE platforms SET ${sets.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/platforms/:id — delete platform
app.delete("/api/platforms/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, "DELETE FROM platforms WHERE id = ?", [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// SOCIAL CHANNELS
// ============================================================

// GET /api/social-channels — list all channels
app.get("/api/social-channels", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      "SELECT * FROM social_channels ORDER BY name ASC"
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/social-channels — create channel
app.post("/api/social-channels", async (c) => {
  try {
    const body = await c.req.json<{
      name?: string;
      caption_max_chars?: number;
      hashtag_count?: number;
      tone?: string;
      format?: string;
      content_types?: string[];
    }>();

    if (!body.name) {
      return c.json<ApiResponse>(
        { success: false, error: "name is required" },
        400
      );
    }

    const id = generateId();
    const slug = slugify(body.name);

    await storageQuery(
      c.env,
      `INSERT INTO social_channels (id, name, slug, caption_max_chars, hashtag_count,
       tone, format, content_types, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        body.name,
        slug,
        body.caption_max_chars ?? null,
        body.hashtag_count ?? null,
        body.tone ?? null,
        body.format ?? null,
        body.content_types ? JSON.stringify(body.content_types) : null,
      ]
    );

    return c.json<ApiResponse>(
      { success: true, data: { id, name: body.name, slug } },
      201
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/social-channels/:id — update channel rules
app.put("/api/social-channels/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      caption_max_chars?: number;
      hashtag_count?: number;
      tone?: string;
      format?: string;
      content_types?: string[];
      is_active?: boolean;
    }>();

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      sets.push("name = ?", "slug = ?");
      params.push(body.name, slugify(body.name));
    }
    if (body.caption_max_chars !== undefined) {
      sets.push("caption_max_chars = ?");
      params.push(body.caption_max_chars);
    }
    if (body.hashtag_count !== undefined) {
      sets.push("hashtag_count = ?");
      params.push(body.hashtag_count);
    }
    if (body.tone !== undefined) {
      sets.push("tone = ?");
      params.push(body.tone);
    }
    if (body.format !== undefined) {
      sets.push("format = ?");
      params.push(body.format);
    }
    if (body.content_types !== undefined) {
      sets.push("content_types = ?");
      params.push(JSON.stringify(body.content_types));
    }
    if (body.is_active !== undefined) {
      sets.push("is_active = ?");
      params.push(body.is_active ? 1 : 0);
    }

    if (sets.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No fields to update" },
        400
      );
    }

    params.push(id);
    await storageQuery(
      c.env,
      `UPDATE social_channels SET ${sets.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/social-channels/:id — delete channel
app.delete("/api/social-channels/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, "DELETE FROM social_channels WHERE id = ?", [
      id,
    ]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// PROMPTS
// ============================================================

// GET /api/prompts — list all prompt templates
app.get("/api/prompts", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      "SELECT * FROM prompt_templates ORDER BY layer ASC, name ASC"
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/prompts/:layer — list prompts by layer
app.get("/api/prompts/:layer", async (c) => {
  try {
    const layer = c.req.param("layer");
    const validLayers = [
      "master",
      "role",
      "domain",
      "category",
      "platform",
      "social",
      "review",
      "context",
    ];

    if (!validLayers.includes(layer)) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: `Invalid layer. Must be one of: ${validLayers.join(", ")}`,
        },
        400
      );
    }

    const data = await storageQuery(
      c.env,
      "SELECT * FROM prompt_templates WHERE layer = ? ORDER BY name ASC",
      [layer]
    );

    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/prompts/:id — update prompt template
app.put("/api/prompts/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      prompt?: string;
      is_active?: boolean;
    }>();

    const sets: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      sets.push("name = ?");
      params.push(body.name);
    }
    if (body.prompt !== undefined) {
      sets.push("prompt = ?");
      params.push(body.prompt);
      // Auto-increment version when prompt text changes
      sets.push("version = version + 1");
    }
    if (body.is_active !== undefined) {
      sets.push("is_active = ?");
      params.push(body.is_active ? 1 : 0);
    }

    if (sets.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No fields to update" },
        400
      );
    }

    sets.push("updated_at = ?");
    params.push(now());
    params.push(id);

    await storageQuery(
      c.env,
      `UPDATE prompt_templates SET ${sets.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// AI MANAGER — forwards to nexus-ai
// ============================================================

// GET /api/ai/models — list all AI models with health
app.get("/api/ai/models", async (c) => {
  try {
    const result = await forwardToService(c.env.NEXUS_AI, "/ai/registry");
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/ai/health — health report
app.get("/api/ai/health", async (c) => {
  try {
    const result = await forwardToService(c.env.NEXUS_AI, "/ai/health");
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/ai/models/reorder — reorder failover chain
app.post("/api/ai/models/reorder", async (c) => {
  try {
    const body = await c.req.json<{
      taskType?: string;
      modelIds?: string[];
    }>();

    if (!body.taskType || !body.modelIds) {
      return c.json<ApiResponse>(
        { success: false, error: "taskType and modelIds are required" },
        400
      );
    }

    const result = await forwardToService(
      c.env.NEXUS_AI,
      "/ai/registry/reorder",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    return c.json<ApiResponse>(result, result.success ? 200 : 400);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// ASSETS / CONTENT
// ============================================================

// GET /api/assets — list all assets
app.get("/api/assets", async (c) => {
  try {
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "50", 10);
    const offset = (page - 1) * pageSize;

    const countResult = (await storageQuery(
      c.env,
      "SELECT COUNT(*) as total FROM assets"
    )) as Array<{ total: number }>;

    const total = countResult?.[0]?.total ?? 0;

    const data = await storageQuery(
      c.env,
      `SELECT a.*, p.name as product_name
       FROM assets a
       LEFT JOIN products p ON p.id = a.product_id
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return c.json({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/assets/:productId — list assets for product
app.get("/api/assets/:productId", async (c) => {
  try {
    const productId = c.req.param("productId");
    const data = await storageQuery(
      c.env,
      "SELECT * FROM assets WHERE product_id = ? ORDER BY created_at DESC",
      [productId]
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/assets/:id — delete asset (synced cleanup)
app.delete("/api/assets/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await storageCleanup(c.env, "asset", id);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// ANALYTICS (V4)
// ============================================================

// GET /api/analytics/overview — total products, AI usage, cache hit rate, cost savings
app.get("/api/analytics/overview", async (c) => {
  try {
    const [productCounts, aiUsage, cacheStats] = await Promise.all([
      storageQuery(
        c.env,
        `SELECT
          COUNT(*) as total_products,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
          SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending_review
        FROM products`
      ),
      storageQuery(
        c.env,
        `SELECT
          SUM(tokens_used) as total_tokens,
          SUM(cost) as total_cost,
          COUNT(*) as total_ai_calls
        FROM analytics WHERE event_type = 'ai_call'`
      ),
      storageQuery(
        c.env,
        `SELECT
          COUNT(*) as total_cache_checks,
          SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cache_hits
        FROM analytics WHERE event_type IN ('ai_call', 'cache_hit')`
      ),
    ]);

    return c.json<ApiResponse>({
      success: true,
      data: {
        products: productCounts,
        ai_usage: aiUsage,
        cache: cacheStats,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/analytics/ai-usage — tokens per provider, cost breakdown
app.get("/api/analytics/ai-usage", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      `SELECT
        ai_model,
        COUNT(*) as call_count,
        SUM(tokens_used) as total_tokens,
        SUM(cost) as total_cost,
        AVG(latency_ms) as avg_latency_ms,
        SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cache_hits
      FROM analytics
      WHERE event_type = 'ai_call'
      GROUP BY ai_model
      ORDER BY call_count DESC`
    );

    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/analytics/health — AI health leaderboard
app.get("/api/analytics/health", async (c) => {
  try {
    // Get health data from nexus-ai
    const result = await forwardToService(c.env.NEXUS_AI, "/ai/health");

    // Supplement with DB analytics
    const dbHealth = await storageQuery(
      c.env,
      `SELECT
        ai_model,
        COUNT(*) as total_calls,
        SUM(CASE WHEN event_type = 'error' THEN 1 ELSE 0 END) as total_failures,
        AVG(latency_ms) as avg_latency_ms
      FROM analytics
      WHERE ai_model IS NOT NULL
      GROUP BY ai_model
      ORDER BY total_calls DESC`
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        live_health: result.data,
        historical: dbHealth,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// HISTORY
// ============================================================

// GET /api/history — all past workflow runs
app.get("/api/history", async (c) => {
  try {
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "50", 10);
    const offset = (page - 1) * pageSize;

    const countResult = (await storageQuery(
      c.env,
      "SELECT COUNT(*) as total FROM workflow_runs"
    )) as Array<{ total: number }>;

    const total = countResult?.[0]?.total ?? 0;

    const data = await storageQuery(
      c.env,
      `SELECT wr.*, p.name as product_name, p.domain_id, p.category_id
       FROM workflow_runs wr
       LEFT JOIN products p ON p.id = wr.product_id
       ORDER BY wr.started_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return c.json({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/history/:runId — detailed run with all steps
app.get("/api/history/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    const runs = (await storageQuery(
      c.env,
      `SELECT wr.*, p.name as product_name, p.domain_id, p.category_id, p.niche
       FROM workflow_runs wr
       LEFT JOIN products p ON p.id = wr.product_id
       WHERE wr.id = ?`,
      [runId]
    )) as Array<Record<string, unknown>>;

    if (!runs || (runs as unknown[]).length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Workflow run not found" },
        404
      );
    }

    const steps = await storageQuery(
      c.env,
      "SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_order ASC",
      [runId]
    );

    const reviews = await storageQuery(
      c.env,
      "SELECT * FROM reviews WHERE run_id = ? ORDER BY version DESC",
      [runId]
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        ...runs[0],
        steps,
        reviews,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// SETTINGS
// ============================================================

// GET /api/settings — all settings
app.get("/api/settings", async (c) => {
  try {
    const data = await storageQuery(
      c.env,
      "SELECT * FROM settings ORDER BY key ASC"
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/settings — update settings (accepts object of key-value pairs)
app.put("/api/settings", async (c) => {
  try {
    const body = await c.req.json<Record<string, string>>();

    if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
      return c.json<ApiResponse>(
        {
          success: false,
          error:
            "Request body must be a non-empty object of key-value pairs",
        },
        400
      );
    }

    const ts = now();
    const updated: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string") continue;

      await storageQuery(
        c.env,
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
        [key, value, ts, value, ts]
      );
      updated.push(key);
    }

    return c.json<ApiResponse>({
      success: true,
      data: { updated_keys: updated },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// 404 catch-all
// ============================================================

app.notFound((c) => {
  return c.json<ApiResponse>(
    {
      success: false,
      error: `Route not found: ${c.req.method} ${c.req.path}`,
    },
    404
  );
});

// ============================================================
// Global error handler
// ============================================================

app.onError((err, c) => {
  console.error("[ROUTER] Unhandled error:", err.message);
  return c.json<ApiResponse>(
    { success: false, error: "Internal server error" },
    500
  );
});

export default app;
