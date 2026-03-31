import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const settings = new Hono<{ Bindings: RouterEnv }>();

// GET /api/settings/:key — get single setting by key
settings.get("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const data = await storageQuery(
      c.env,
      "SELECT * FROM settings WHERE key = ? LIMIT 1",
      [key]
    );
    const results = data as Record<string, unknown>[];
    if (!results || results.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Setting not found" },
        404
      );
    }
    return c.json<ApiResponse>({ success: true, data: results[0] });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/settings/:key — update a single setting
settings.put("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const body = await c.req.json<{ value?: string }>();

    if (!body.value && body.value !== "") {
      return c.json<ApiResponse>(
        { success: false, error: "value is required" },
        400
      );
    }

    const ts = now();
    await storageQuery(
      c.env,
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, body.value, ts]
    );

    return c.json<ApiResponse>({
      success: true,
      data: { key, value: body.value },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/settings — all settings
settings.get("/", async (c) => {
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
settings.put("/", async (c) => {
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
    const entries = Object.entries(body).filter(
      ([, value]) => typeof value === "string"
    );

    if (entries.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No valid string values provided" },
        400
      );
    }

    // Batch all settings into a single INSERT with ON CONFLICT (8.3)
    const placeholders = entries.map(() => "(?, ?, ?)").join(", ");
    const params = entries.flatMap(([key, value]) => [key, value, ts]);
    await storageQuery(
      c.env,
      `INSERT INTO settings (key, value, updated_at) VALUES ${placeholders}
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      params
    );

    const updated = entries.map(([key]) => key);

    return c.json<ApiResponse>({
      success: true,
      data: { updated_keys: updated },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default settings;
