// ============================================================
// Shared helpers for nexus-router route modules
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";

// ── Input Sanitization ──────────────────────────────────────

/** Patterns that indicate prompt injection attempts */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\[\s*INST\s*\]/i,
  /<\|im_start\|>/i,
  /\{\{\s*system/i,
];

/**
 * Sanitize user input to prevent basic prompt injection.
 * Strips control characters and flags suspicious patterns.
 */
export function sanitizeInput(input: string): string {
  // Remove zero-width and control characters (except newlines/tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\uFEFF]/g, "");
  // Trim excessive whitespace
  sanitized = sanitized.trim();
  // Strip any detected prompt injection patterns from the input
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn(`[SANITIZE] Prompt injection stripped: ${pattern}`);
      sanitized = sanitized.replace(pattern, "");
    }
  }
  // Clean up any leftover whitespace from stripped patterns
  sanitized = sanitized.replace(/\s{2,}/g, " ").trim();
  return sanitized;
}

/**
 * Validate that a request body field is a non-empty string.
 * Returns the sanitized value or null if invalid.
 */
export function validateStringField(
  body: Record<string, unknown>,
  field: string
): string | null {
  const value = body[field];
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return sanitizeInput(value);
}

// ── Router Env extends shared Env with DASHBOARD_SECRET ─────
export interface RouterEnv extends Env {
  DASHBOARD_SECRET?: string;
  CUSTOM_DOMAIN_ORIGIN?: string;
}

/**
 * Internal response shape from nexus-storage D1 endpoints.
 * nexus-storage may wrap rows in `{ results: [...] }` or return them directly.
 */
interface StorageD1Response {
  success: boolean;
  error?: string;
  data?: { results?: unknown[] } | unknown[] | unknown;
}

/**
 * Forward a fetch to nexus-storage for D1 queries.
 *
 * Returns a **consistent** shape to callers:
 *  - SELECT queries → always returns `T[]` (an array of rows).
 *  - INSERT/UPDATE/DELETE → returns the raw data (usually `{ meta: ... }`).
 *
 * This normalizes the inconsistency where nexus-storage sometimes wraps rows
 * inside `{ results: [...] }` and sometimes returns the array directly.
 */
export async function storageQuery<T = unknown>(
  env: RouterEnv,
  sql: string,
  params: unknown[] = [],
  requestId?: string
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (requestId) headers["X-Request-ID"] = requestId;
  const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
    method: "POST",
    headers,
    body: JSON.stringify({ sql, params }),
  });
  const json = (await resp.json()) as StorageD1Response;
  if (!json.success) {
    throw new Error(json.error ?? "Storage query failed");
  }

  const data = json.data;

  // Normalize: if data is `{ results: [...] }`, unwrap to the array.
  // This ensures callers always receive rows as a plain array for SELECT queries.
  if (
    data !== null &&
    data !== undefined &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "results" in (data as Record<string, unknown>)
  ) {
    return (data as { results: unknown[] }).results as T;
  }

  return data as T;
}

/** Forward a fetch to nexus-storage for synced cleanup */
export async function storageCleanup(
  env: RouterEnv,
  entity: string,
  id: string
): Promise<ApiResponse> {
  const resp = await env.NEXUS_STORAGE.fetch(
    `http://nexus-storage/cleanup/${entity}/${id}`,
    { method: "DELETE" }
  );
  return (await resp.json()) as ApiResponse;
}

/** Forward a request to a service binding worker and return its JSON response */
export async function forwardToService(
  service: Fetcher,
  path: string,
  init?: RequestInit,
  requestId?: string
): Promise<ApiResponse> {
  const headers = new Headers(init?.headers);
  if (requestId) headers.set("X-Request-ID", requestId);
  const resp = await service.fetch(`http://internal${path}`, {
    ...init,
    headers,
  });
  return (await resp.json()) as ApiResponse;
}

/** Standard error response */
export function errorResponse(
  c: { json: <T>(data: T, status?: number) => Response },
  err: unknown,
  status = 500
): Response {
  const message = err instanceof Error ? err.message : String(err);
  return c.json<ApiResponse>({ success: false, error: message }, status);
}
