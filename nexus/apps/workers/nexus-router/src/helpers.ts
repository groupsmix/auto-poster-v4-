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
  // Log (but don't block) if injection patterns are detected
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn(`[SANITIZE] Potential prompt injection detected: ${pattern}`);
      break;
    }
  }
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

/** Forward a fetch to nexus-storage for D1 queries */
export async function storageQuery(
  env: RouterEnv,
  sql: string,
  params: unknown[] = [],
  requestId?: string
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (requestId) headers["X-Request-ID"] = requestId;
  const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
    method: "POST",
    headers,
    body: JSON.stringify({ sql, params }),
  });
  const json = (await resp.json()) as ApiResponse;
  if (!json.success) {
    throw new Error(json.error ?? "Storage query failed");
  }
  return json.data;
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
