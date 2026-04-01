// ============================================================
// Publish Queue Routes — manage auto-publish queue
// GET  /api/publish-queue          — list queue items
// POST /api/publish-queue/:id/retry — retry a failed item
// POST /api/publish-queue/:id/cancel — cancel a pending item
// POST /api/publish-queue/process  — manually trigger queue processing
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse } from "../helpers";
import {
  getPublishQueue,
  retryPublishItem,
  cancelPublishItem,
  processPublishQueue,
} from "../services/publish-service";

const publishQueue = new Hono<{ Bindings: RouterEnv }>();

// GET /api/publish-queue — list queue items (optional ?status=pending|published|failed)
publishQueue.get("/", async (c) => {
  try {
    const status = c.req.query("status") as
      | "pending"
      | "publishing"
      | "published"
      | "failed"
      | undefined;
    const data = await getPublishQueue(c.env, status);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/publish-queue/:id/retry — retry a failed publish
publishQueue.post("/:id/retry", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await retryPublishItem(id, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/publish-queue/:id/cancel — cancel a pending publish
publishQueue.post("/:id/cancel", async (c) => {
  try {
    const id = c.req.param("id");
    const result = await cancelPublishItem(id, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/publish-queue/process — manually trigger queue processing
publishQueue.post("/process", async (c) => {
  try {
    const result = await processPublishQueue(c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default publishQueue;
