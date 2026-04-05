import { Hono } from "hono";
import type { ApiResponse, PaginatedResponse } from "@nexus/shared";
import { generateId, slugify, now, DEFAULT_PAGE_SIZE, PRODUCT_STATUS } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, storageCleanup, errorResponse, validateStringField, sanitizeInput } from "../helpers";

const products = new Hono<{ Bindings: RouterEnv }>();

// GET /api/products — list all products (with filters)
products.get("/", async (c) => {
  try {
    const domain = c.req.query("domain");
    const category = c.req.query("category");
    const status = c.req.query("status");
    const batch = c.req.query("batch");
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10);
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

    const countResult = await storageQuery<{ results?: Array<{ total: number }> }>(
      c.env,
      `SELECT COUNT(*) as total FROM products WHERE ${where}`,
      params
    );

    const total = countResult?.results?.[0]?.total ?? 0;

    const data = await storageQuery<unknown[]>(
      c.env,
      `SELECT * FROM products WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return c.json<PaginatedResponse>({
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
products.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const queryResult = await storageQuery<{ results?: Array<Record<string, unknown>> }>(
      c.env,
      "SELECT * FROM products WHERE id = ?",
      [id]
    );

    const rows = queryResult?.results ?? [];
    if (rows.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Product not found" },
        404
      );
    }

    const product = rows[0];

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
products.post("/", async (c) => {
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

    const domainId = validateStringField(body as Record<string, unknown>, "domain_id");
    const categoryId = validateStringField(body as Record<string, unknown>, "category_id");
    if (!domainId || !categoryId) {
      return c.json<ApiResponse>(
        { success: false, error: "domain_id and category_id are required (non-empty strings)" },
        400
      );
    }
    body.domain_id = domainId;
    body.category_id = categoryId;

    // Resolve slugs to actual DB IDs (frontend may send slugs, DB expects UUIDs)
    const domainRows = await storageQuery<Array<{ id: string }>>(
      c.env,
      "SELECT id FROM domains WHERE id = ? OR slug = ? LIMIT 1",
      [domainId, domainId]
    );
    const categoryRows = await storageQuery<Array<{ id: string }>>(
      c.env,
      "SELECT id FROM categories WHERE id = ? OR slug = ? LIMIT 1",
      [categoryId, categoryId]
    );

    const resolvedDomainId = domainRows?.[0]?.id ?? domainId;
    const resolvedCategoryId = categoryRows?.[0]?.id ?? categoryId;

    // Sanitize user-facing text fields
    if (body.name) body.name = sanitizeInput(body.name);
    if (body.niche) body.niche = sanitizeInput(body.niche);
    if (body.description) body.description = sanitizeInput(body.description);
    if (body.keywords) body.keywords = sanitizeInput(body.keywords);

    const id = generateId();
    const productName = body.name ?? body.niche ?? "Untitled";
    const slug = slugify(productName);
    const ts = now();

    await storageQuery(
      c.env,
      `INSERT INTO products (id, domain_id, category_id, name, slug, niche, language, status, user_input, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '${PRODUCT_STATUS.DRAFT}', ?, ?, ?)`,
      [
        id,
        resolvedDomainId,
        resolvedCategoryId,
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
products.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await storageCleanup(c.env, "product", id);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default products;
