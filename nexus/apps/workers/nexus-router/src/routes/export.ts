import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const exportRoutes = new Hono<{ Bindings: RouterEnv }>();

// GET /api/export/full — dump all tables as JSON for backup (7.7)
exportRoutes.get("/full", async (c) => {
  try {
    const tables = [
      "domains",
      "categories",
      "products",
      "platform_variants",
      "social_variants",
      "assets",
      "workflow_runs",
      "workflow_steps",
      "reviews",
      "settings",
      "prompts",
      "ai_analytics",
    ];

    const results: Record<string, unknown> = {};

    // Fetch all tables in parallel
    const queries = tables.map((table) =>
      storageQuery(c.env, `SELECT * FROM ${table}`)
        .then((data) => ({ table, data }))
        .catch(() => ({ table, data: [] }))
    );

    const tableResults = await Promise.all(queries);
    for (const { table, data } of tableResults) {
      results[table] = data;
    }

    return c.json<ApiResponse>({
      success: true,
      data: {
        exported_at: new Date().toISOString(),
        tables: results,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default exportRoutes;
