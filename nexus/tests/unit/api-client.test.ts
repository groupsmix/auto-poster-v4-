// ============================================================
// Unit Tests — Frontend API client logic
// Tests for nexus/apps/web/lib/api/client.ts
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Replicate the core API client logic for testing in node environment

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  fetchFn: typeof fetch = fetch
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchFn(url, options);
      if (response.ok || response.status < 500) return response;
      lastResponse = response;
      if (i < retries) await new Promise((r) => setTimeout(r, 10)); // shortened for tests
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  // Return the last 5xx response so callers can read the actual error
  if (lastResponse) return lastResponse;

  throw new Error("Max retries exceeded");
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

describe("fetchWithRetry", () => {
  it("returns immediately on successful response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const result = await fetchWithRetry("https://example.com/api", {}, 2, mockFetch);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns immediately on 4xx (client error, no retry)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    );
    const result = await fetchWithRetry("https://example.com/api", {}, 2, mockFetch);
    expect(result.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx server errors", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await fetchWithRetry("https://example.com/api", {}, 2, mockFetch);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on network errors", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await fetchWithRetry("https://example.com/api", {}, 2, mockFetch);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries on network error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(
      fetchWithRetry("https://example.com/api", {}, 2, mockFetch)
    ).rejects.toThrow("Network error");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns last 5xx response after exhausting retries (surfaces real error)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "D1 connection failed" }), { status: 500 })
    );

    const result = await fetchWithRetry("https://example.com/api", {}, 2, mockFetch);
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe("D1 connection failed");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("respects custom retry count and returns last 5xx response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503 })
    );

    const result = await fetchWithRetry("https://example.com/api", {}, 0, mockFetch);
    expect(result.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("API response shape", () => {
  it("success response has correct shape", () => {
    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: { id: "123" },
    };
    expect(response.success).toBe(true);
    expect(response.data?.id).toBe("123");
    expect(response.error).toBeUndefined();
  });

  it("error response has correct shape", () => {
    const response: ApiResponse = {
      success: false,
      error: "Something went wrong",
    };
    expect(response.success).toBe(false);
    expect(response.error).toBe("Something went wrong");
    expect(response.data).toBeUndefined();
  });
});
