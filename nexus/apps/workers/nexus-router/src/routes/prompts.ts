import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { generateId, now } from "@nexus/shared";
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
      // Save current prompt to prompt_versions before overwriting
      try {
        const current = (await storageQuery(
          c.env,
          "SELECT id, prompt, version, name, layer FROM prompt_templates WHERE id = ?",
          [id]
        )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };
        const rows = Array.isArray(current) ? current : (current?.results ?? []);
        if (rows.length > 0 && rows[0].prompt) {
          await storageQuery(
            c.env,
            `INSERT INTO prompt_versions (id, prompt_id, version, prompt, name, layer, changed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              generateId(),
              id,
              rows[0].version as number,
              rows[0].prompt as string,
              rows[0].name as string,
              rows[0].layer as string,
              now(),
            ]
          );
        }
      } catch (versionErr) {
        // Non-fatal: version history is best-effort
        console.error("[PROMPTS] Failed to save prompt version:", versionErr);
      }

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

// GET /api/prompts/:id/history — get version history for a prompt
prompts.get("/:id/history", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await storageQuery(
      c.env,
      "SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version DESC",
      [id]
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/prompts/:id/revert/:versionId — revert a prompt to a previous version
prompts.post("/:id/revert/:versionId", async (c) => {
  try {
    const id = c.req.param("id");
    const versionId = c.req.param("versionId");

    // Fetch the version to revert to
    const versionResult = (await storageQuery(
      c.env,
      "SELECT prompt, version FROM prompt_versions WHERE id = ? AND prompt_id = ?",
      [versionId, id]
    )) as Array<{ prompt: string; version: number }> | { results?: Array<{ prompt: string; version: number }> };

    const rows = Array.isArray(versionResult) ? versionResult : (versionResult?.results ?? []);
    if (rows.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Version not found" },
        404
      );
    }

    // Save current prompt as a version before reverting
    const current = (await storageQuery(
      c.env,
      "SELECT prompt, version, name, layer FROM prompt_templates WHERE id = ?",
      [id]
    )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };
    const currentRows = Array.isArray(current) ? current : (current?.results ?? []);
    if (currentRows.length > 0 && currentRows[0].prompt) {
      await storageQuery(
        c.env,
        `INSERT INTO prompt_versions (id, prompt_id, version, prompt, name, layer, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          id,
          currentRows[0].version as number,
          currentRows[0].prompt as string,
          currentRows[0].name as string,
          currentRows[0].layer as string,
          now(),
        ]
      );
    }

    // Revert the prompt
    await storageQuery(
      c.env,
      "UPDATE prompt_templates SET prompt = ?, version = version + 1, updated_at = ? WHERE id = ?",
      [rows[0].prompt, now(), id]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { id, reverted_to_version: rows[0].version },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default prompts;
