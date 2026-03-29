import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { generateId, slugify } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, storageCleanup, errorResponse } from "../helpers";

const categories = new Hono<{ Bindings: RouterEnv }>();

// POST /api/categories — create category
categories.post("/", async (c) => {
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
categories.put("/:id", async (c) => {
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
categories.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await storageCleanup(c.env, "category", id);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default categories;
