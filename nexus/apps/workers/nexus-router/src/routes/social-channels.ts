import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { generateId, slugify } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse, sanitizeInput } from "../helpers";

const socialChannels = new Hono<{ Bindings: RouterEnv }>();

// GET /api/social-channels — list all channels
socialChannels.get("/", async (c) => {
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
socialChannels.post("/", async (c) => {
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

    body.name = sanitizeInput(body.name);
    if (body.tone) body.tone = sanitizeInput(body.tone);
    if (body.format) body.format = sanitizeInput(body.format);

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
socialChannels.put("/:id", async (c) => {
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
      body.name = sanitizeInput(body.name);
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
      body.tone = sanitizeInput(body.tone);
      sets.push("tone = ?");
      params.push(body.tone);
    }
    if (body.format !== undefined) {
      body.format = sanitizeInput(body.format);
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
socialChannels.delete("/:id", async (c) => {
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

export default socialChannels;
