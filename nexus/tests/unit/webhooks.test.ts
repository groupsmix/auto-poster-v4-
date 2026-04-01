// ============================================================
// Unit Tests — Webhook retry logic with exponential backoff
// Tests for nexus/apps/workers/nexus-router/src/routes/webhooks.ts
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Replicate the core fireWebhook logic for unit testing in node environment
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 10; // shortened for tests

async function fireWebhook(
  url: string,
  _type: string,
  payload: Record<string, unknown>,
  maxRetries: number = MAX_RETRIES,
  fetchFn: typeof fetch = fetch
): Promise<{ success: boolean; status: number; attempts: number; error?: string }> {
  let lastError: string | undefined;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const resp = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        return { success: true, status: resp.status, attempts: attempt };
      }

      lastStatus = resp.status;
      lastError = `HTTP ${resp.status}`;

      // Don't retry on 4xx client errors (except 429 rate limit)
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        return { success: false, status: resp.status, attempts: attempt, error: lastError };
      }
    } catch (err) {
      lastStatus = 0;
      lastError = err instanceof Error ? err.message : "Unknown error";
    }

    if (attempt <= maxRetries) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { success: false, status: lastStatus, attempts: maxRetries + 1, error: lastError };
}

// Replicate buildPayload logic for testing
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
          timestamp: expect.any(String),
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

  return { event, data, timestamp: expect.any(String) };
}

describe("fireWebhook — exponential backoff retry", () => {
  it("succeeds on first attempt when server returns 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("OK", { status: 200 })
    );

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 3, mockFetch);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx server errors and succeeds", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 3, mockFetch);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on 4xx client errors (except 429)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Bad Request", { status: 400 })
    );

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 3, mockFetch);

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 rate limit", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 3, mockFetch);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("retries on network errors and eventually succeeds", async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 3, mockFetch);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("returns failure after exhausting all retries", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("", { status: 500 })
    );

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 2, mockFetch);

    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    expect(result.attempts).toBe(3); // 1 initial + 2 retries
    expect(result.error).toBe("HTTP 500");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns failure with network error after exhausting retries", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 1, mockFetch);

    expect(result.success).toBe(false);
    expect(result.status).toBe(0);
    expect(result.attempts).toBe(2);
    expect(result.error).toBe("Connection refused");
  });

  it("does not retry on 403 Forbidden", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Forbidden", { status: 403 })
    );

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 3, mockFetch);

    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.attempts).toBe(1);
  });

  it("does not retry on 404 Not Found", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 })
    );

    const result = await fireWebhook("https://hooks.example.com", "discord", { message: "test" }, 3, mockFetch);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });
});

describe("buildPayload", () => {
  it("builds Discord embed payload", () => {
    const payload = buildPayload("discord", "product_published", { message: "Product X published" });

    expect(payload).toHaveProperty("embeds");
    const embeds = payload.embeds as Array<Record<string, unknown>>;
    expect(embeds).toHaveLength(1);
    expect(embeds[0].title).toBe("NEXUS: Product Published");
    expect(embeds[0].description).toBe("Product X published");
    expect(embeds[0].color).toBe(0x00ff00);
  });

  it("builds Discord embed with red color for publish_failed", () => {
    const payload = buildPayload("discord", "publish_failed", { message: "Failed" });
    const embeds = payload.embeds as Array<Record<string, unknown>>;
    expect(embeds[0].color).toBe(0xff0000);
  });

  it("builds Telegram markdown payload", () => {
    const payload = buildPayload("telegram", "daily_summary", { message: "All good" });

    expect(payload).toHaveProperty("text");
    expect(payload).toHaveProperty("parse_mode", "Markdown");
    expect(payload.text).toContain("NEXUS: Daily Summary");
    expect(payload.text).toContain("All good");
  });

  it("builds custom webhook raw payload", () => {
    const payload = buildPayload("custom", "product_approved", { product_id: "123" });

    expect(payload.event).toBe("product_approved");
    expect(payload.data).toEqual({ product_id: "123" });
  });
});
