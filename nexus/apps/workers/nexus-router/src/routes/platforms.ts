import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { generateId, slugify } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const platforms = new Hono<{ Bindings: RouterEnv }>();

// GET /api/platforms — list all platforms
platforms.get("/", async (c) => {
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
platforms.post("/", async (c) => {
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
platforms.put("/:id", async (c) => {
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
platforms.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, "DELETE FROM platforms WHERE id = ?", [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default platforms;
