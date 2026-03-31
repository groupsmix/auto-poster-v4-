import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { generateId, slugify, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, storageCleanup, errorResponse, sanitizeInput } from "../helpers";

const domains = new Hono<{ Bindings: RouterEnv }>();

// GET /api/domains/:slug — get single domain by slug or id
domains.get("/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const results = await storageQuery<Record<string, unknown>[]>(
      c.env,
      "SELECT * FROM domains WHERE slug = ? OR id = ? LIMIT 1",
      [slug, slug]
    );
    if (!results || results.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Domain not found" },
        404
      );
    }
    return c.json<ApiResponse>({ success: true, data: results[0] });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/domains/reorder — reorder domains
domains.post("/reorder", async (c) => {
  try {
    const body = await c.req.json<{ ids?: string[] }>();
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "ids array is required" },
        400
      );
    }

    // Update sort_order for each domain based on array position
    for (let i = 0; i < body.ids.length; i++) {
      await storageQuery(
        c.env,
        "UPDATE domains SET sort_order = ? WHERE id = ?",
        [i + 1, body.ids[i]]
      );
    }

    return c.json<ApiResponse>({ success: true, data: { reordered: body.ids.length } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/domains — list all domains
domains.get("/", async (c) => {
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
domains.post("/", async (c) => {
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

    body.name = sanitizeInput(body.name);
    if (body.description) body.description = sanitizeInput(body.description);

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
domains.put("/:id", async (c) => {
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
      body.name = sanitizeInput(body.name);
      sets.push("name = ?", "slug = ?");
      params.push(body.name, slugify(body.name));
    }
    if (body.description !== undefined) {
      body.description = sanitizeInput(body.description);
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
domains.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await storageCleanup(c.env, "domain", id);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/domains/:id/categories — list categories for domain
domains.get("/:id/categories", async (c) => {
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

export default domains;
