import { Hono } from "hono";
import type { ApiResponse, PaginatedResponse } from "@nexus/shared";
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

    const countResult = await storageQuery<{ results?: Array<{ total: number }> }>(
      c.env,
      "SELECT COUNT(*) as total FROM workflow_runs"
    );

    const total = countResult?.results?.[0]?.total ?? 0;

    const data = await storageQuery<unknown[]>(
      c.env,
      `SELECT wr.*, p.name as product_name, p.domain_id, p.category_id
       FROM workflow_runs wr
       LEFT JOIN products p ON p.id = wr.product_id
       ORDER BY wr.started_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return c.json<PaginatedResponse>({
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

    const runsResult = await storageQuery<{ results?: Array<Record<string, unknown>> }>(
      c.env,
      `SELECT wr.*, p.name as product_name, p.domain_id, p.category_id, p.niche
       FROM workflow_runs wr
       LEFT JOIN products p ON p.id = wr.product_id
       WHERE wr.id = ?`,
      [runId]
    );

    const runs = runsResult?.results ?? [];
    if (runs.length === 0) {
      return errorResponse(c, new Error("Workflow run not found"), 404);
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
