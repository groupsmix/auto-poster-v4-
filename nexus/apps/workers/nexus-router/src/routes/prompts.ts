import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const prompts = new Hono<{ Bindings: RouterEnv }>();

// GET /api/prompts — list all prompt templates
prompts.get("/", async (c) => {
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
prompts.get("/:layer", async (c) => {
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
prompts.put("/:id", async (c) => {
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

export default prompts;
