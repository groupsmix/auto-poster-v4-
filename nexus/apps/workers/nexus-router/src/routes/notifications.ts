// ============================================================
// Notification Routes
// GET /api/notifications/configs
// POST /api/notifications/configs
// PUT /api/notifications/configs/:id
// DELETE /api/notifications/configs/:id
// GET /api/notifications/logs
// POST /api/notifications/test
// POST /api/notifications/digest
// ============================================================

import { Hono } from "hono";
import { generateId, now } from "@nexus/shared";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";
import { fireNotifications, sendDailyDigest } from "../services/notification-service";

const notifications = new Hono<{ Bindings: RouterEnv }>();

// GET /api/notifications/configs — list all notification configs
notifications.get("/configs", async (c) => {
  try {
    const configs = await storageQuery(
      c.env,
      `SELECT * FROM notification_configs ORDER BY created_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data: configs });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/notifications/configs — create a notification config
notifications.post("/configs", async (c) => {
  try {
    const body = await c.req.json<{
      type: "email" | "sms";
      name: string;
      recipient: string;
      events: string[];
    }>();

    if (!body.type || !body.name || !body.recipient) {
      return c.json<ApiResponse>({ success: false, error: "type, name, and recipient are required" }, 400);
    }

    const id = generateId();
    await storageQuery(
      c.env,
      `INSERT INTO notification_configs (id, type, name, recipient, events, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, body.type, body.name, body.recipient, JSON.stringify(body.events ?? []), now(), now()]
    );

    return c.json<ApiResponse>({ success: true, data: { id } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/notifications/configs/:id — update a notification config
notifications.put("/configs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<{
      name?: string;
      recipient?: string;
      events?: string[];
      is_active?: boolean;
    }>();

    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); params.push(body.name); }
    if (body.recipient !== undefined) { fields.push("recipient = ?"); params.push(body.recipient); }
    if (body.events !== undefined) { fields.push("events = ?"); params.push(JSON.stringify(body.events)); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); params.push(body.is_active ? 1 : 0); }

    if (fields.length === 0) {
      return c.json<ApiResponse>({ success: false, error: "No fields to update" }, 400);
    }

    fields.push("updated_at = ?");
    params.push(now());
    params.push(id);

    await storageQuery(c.env, `UPDATE notification_configs SET ${fields.join(", ")} WHERE id = ?`, params);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/notifications/configs/:id — delete a notification config
notifications.delete("/configs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, `DELETE FROM notification_configs WHERE id = ?`, [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/notifications/logs — list recent notification logs
notifications.get("/logs", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") ?? "50");
    const logs = await storageQuery(
      c.env,
      `SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT ?`,
      [limit]
    );
    return c.json<ApiResponse>({ success: true, data: logs });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/notifications/test — send a test notification
notifications.post("/test", async (c) => {
  try {
    const body = await c.req.json<{ event?: string }>();
    const event = body.event ?? "system_error";
    const results = await fireNotifications(event, { message: "This is a test notification from NEXUS" }, c.env);
    return c.json<ApiResponse>({ success: true, data: { results } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/notifications/digest — trigger daily digest manually
notifications.post("/digest", async (c) => {
  try {
    const result = await sendDailyDigest(c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default notifications;
