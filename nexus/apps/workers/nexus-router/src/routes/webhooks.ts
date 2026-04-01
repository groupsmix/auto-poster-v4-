import { Hono } from "hono";
import type { ApiResponse, WebhookConfig, WebhookLog } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const webhooks = new Hono<{ Bindings: RouterEnv }>();

// GET /api/webhooks — list all webhook configs
webhooks.get("/", async (c) => {
  try {
    const configs = await storageQuery<WebhookConfig[]>(
      c.env,
      `SELECT * FROM webhook_configs ORDER BY created_at DESC`
    );
    // Parse JSON events field
    const parsed = configs.map((cfg) => ({
      ...cfg,
      events: typeof cfg.events === "string" ? JSON.parse(cfg.events as string) : cfg.events,
    }));
    return c.json<ApiResponse>({ success: true, data: parsed });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/webhooks — create a new webhook config
webhooks.post("/", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      url: string;
      type?: string;
      events?: string[];
    }>();

    if (!body.name || !body.url) {
      return c.json<ApiResponse>({ success: false, error: "name and url are required" }, 400);
    }

    const id = crypto.randomUUID();
    const events = JSON.stringify(
      body.events ?? ["product_approved", "product_published", "publish_failed", "daily_summary"]
    );

    await storageQuery(
      c.env,
      `INSERT INTO webhook_configs (id, name, url, type, events) VALUES (?, ?, ?, ?, ?)`,
      [id, body.name, body.url, body.type ?? "discord", events]
    );

    return c.json<ApiResponse>({ success: true, data: { id } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/webhooks/:id — update a webhook config
webhooks.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<Partial<WebhookConfig>>();

    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); params.push(body.name); }
    if (body.url !== undefined) { fields.push("url = ?"); params.push(body.url); }
    if (body.type !== undefined) { fields.push("type = ?"); params.push(body.type); }
    if (body.events !== undefined) { fields.push("events = ?"); params.push(JSON.stringify(body.events)); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); params.push(body.is_active ? 1 : 0); }

    if (fields.length === 0) {
      return c.json<ApiResponse>({ success: false, error: "No fields to update" }, 400);
    }

    fields.push("updated_at = datetime('now')");
    params.push(id);

    await storageQuery(
      c.env,
      `UPDATE webhook_configs SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/webhooks/:id — delete a webhook config
webhooks.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, `DELETE FROM webhook_configs WHERE id = ?`, [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/webhooks/:id/test — send a test webhook
webhooks.post("/:id/test", async (c) => {
  try {
    const id = c.req.param("id");
    const configs = await storageQuery<WebhookConfig[]>(
      c.env,
      `SELECT * FROM webhook_configs WHERE id = ?`,
      [id]
    );

    if (!configs.length) {
      return c.json<ApiResponse>({ success: false, error: "Webhook not found" }, 404);
    }

    const config = configs[0];
    const payload = buildPayload(config.type, "test", {
      message: "Test webhook from NEXUS",
      timestamp: new Date().toISOString(),
    });

    const result = await fireWebhook(config.url, config.type, payload);

    // Log it
    const logId = crypto.randomUUID();
    await storageQuery(
      c.env,
      `INSERT INTO webhook_logs (id, config_id, event_type, payload, status, response_code, error)
       VALUES (?, ?, 'test', ?, ?, ?, ?)`,
      [logId, id, JSON.stringify(payload), result.success ? "sent" : "failed", result.status, result.error ?? null]
    );

    // Update stats
    if (result.success) {
      await storageQuery(c.env, `UPDATE webhook_configs SET total_sent = total_sent + 1, last_fired_at = datetime('now') WHERE id = ?`, [id]);
    } else {
      await storageQuery(c.env, `UPDATE webhook_configs SET total_failed = total_failed + 1 WHERE id = ?`, [id]);
    }

    return c.json<ApiResponse>({ success: result.success, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/webhooks/logs — get recent webhook logs
webhooks.get("/logs", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") ?? "50");
    const logs = await storageQuery<WebhookLog[]>(
      c.env,
      `SELECT wl.*, wc.name as config_name
       FROM webhook_logs wl
       LEFT JOIN webhook_configs wc ON wc.id = wl.config_id
       ORDER BY wl.sent_at DESC
       LIMIT ?`,
      [limit]
    );
    return c.json<ApiResponse>({ success: true, data: logs });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/webhooks/fire — fire webhooks for an event (internal use)
webhooks.post("/fire", async (c) => {
  try {
    const body = await c.req.json<{ event: string; data: Record<string, unknown> }>();
    const configs = await storageQuery<WebhookConfig[]>(
      c.env,
      `SELECT * FROM webhook_configs WHERE is_active = 1`
    );

    const results: Array<{ config_id: string; success: boolean }> = [];

    for (const config of configs) {
      const events = typeof config.events === "string" ? JSON.parse(config.events as string) : config.events;
      if (!events.includes(body.event)) continue;

      const payload = buildPayload(config.type, body.event, body.data);
      const result = await fireWebhook(config.url, config.type, payload);

      const logId = crypto.randomUUID();
      await storageQuery(
        c.env,
        `INSERT INTO webhook_logs (id, config_id, event_type, payload, status, response_code, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [logId, config.id, body.event, JSON.stringify(payload), result.success ? "sent" : "failed", result.status, result.error ?? null]
      );

      if (result.success) {
        await storageQuery(c.env, `UPDATE webhook_configs SET total_sent = total_sent + 1, last_fired_at = datetime('now') WHERE id = ?`, [config.id]);
      } else {
        await storageQuery(c.env, `UPDATE webhook_configs SET total_failed = total_failed + 1 WHERE id = ?`, [config.id]);
      }

      results.push({ config_id: config.id, success: result.success });
    }

    return c.json<ApiResponse>({ success: true, data: results });
  } catch (err) {
    return errorResponse(c, err);
  }
});

function buildPayload(
  type: string,
  event: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const eventLabels: Record<string, string> = {
    product_approved: "Product Approved",
    product_published: "Product Published",
    publish_failed: "Publish Failed",
    daily_summary: "Daily Summary",
    test: "Test Webhook",
  };

  const title = eventLabels[event] ?? event;

  if (type === "discord") {
    return {
      embeds: [
        {
          title: `NEXUS: ${title}`,
          description: data.message ?? JSON.stringify(data),
          color: event === "publish_failed" ? 0xff0000 : 0x00ff00,
          timestamp: new Date().toISOString(),
          fields: Object.entries(data)
            .filter(([k]) => k !== "message")
            .map(([k, v]) => ({ name: k, value: String(v), inline: true })),
        },
      ],
    };
  }

  if (type === "telegram") {
    const text = `*NEXUS: ${title}*\n${data.message ?? JSON.stringify(data)}`;
    return { text, parse_mode: "Markdown" };
  }

  // Custom webhook — raw payload
  return { event, data, timestamp: new Date().toISOString() };
}

async function fireWebhook(
  url: string,
  _type: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; status: number; error?: string }> {
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { success: resp.ok, status: resp.status };
  } catch (err) {
    return {
      success: false,
      status: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default webhooks;
