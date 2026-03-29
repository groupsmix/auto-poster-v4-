import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { DEFAULT_PAGE_SIZE } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const history = new Hono<{ Bindings: RouterEnv }>();

// GET /api/history — all past workflow runs
history.get("/", async (c) => {
  try {
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10);
    const offset = (page - 1) * pageSize;

    const countResult = (await storageQuery(
      c.env,
      "SELECT COUNT(*) as total FROM workflow_runs"
    )) as Array<{ total: number }>;

    const total = countResult?.[0]?.total ?? 0;

    const data = await storageQuery(
      c.env,
      `SELECT wr.*, p.name as product_name, p.domain_id, p.category_id
       FROM workflow_runs wr
       LEFT JOIN products p ON p.id = wr.product_id
       ORDER BY wr.started_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return c.json({
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

// GET /api/history/:runId — detailed run with all steps
history.get("/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");

    const runs = (await storageQuery(
      c.env,
      `SELECT wr.*, p.name as product_name, p.domain_id, p.category_id, p.niche
       FROM workflow_runs wr
       LEFT JOIN products p ON p.id = wr.product_id
       WHERE wr.id = ?`,
      [runId]
    )) as Array<Record<string, unknown>>;

    if (!runs || (runs as unknown[]).length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Workflow run not found" },
        404
      );
    }

    const steps = await storageQuery(
      c.env,
      "SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_order ASC",
      [runId]
    );

    const reviews = await storageQuery(
      c.env,
      "SELECT * FROM reviews WHERE run_id = ? ORDER BY version DESC",
      [runId]
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        ...runs[0],
        steps,
        reviews,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default history;
