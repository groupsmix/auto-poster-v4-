import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const settings = new Hono<{ Bindings: RouterEnv }>();

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

export default settings;
