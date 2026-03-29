// ============================================================
// Shared helpers for nexus-router route modules
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";

// ── Router Env extends shared Env with DASHBOARD_SECRET ─────
export interface RouterEnv extends Env {
  DASHBOARD_SECRET?: string;
}

/** Forward a fetch to nexus-storage for D1 queries */
export async function storageQuery(
  env: RouterEnv,
  sql: string,
  params: unknown[] = []
): Promise<unknown> {
  const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const json = (await resp.json()) as ApiResponse;
  if (!json.success) {
    throw new Error(json.error ?? "Storage query failed");
  }
  return json.data;
}

/** Typed wrapper — returns rows from a SELECT query */
export async function storageQueryRows<T>(
  env: RouterEnv,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await storageQuery(env, sql, params);
  return (result ?? []) as T[];
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
  init?: RequestInit
): Promise<ApiResponse> {
  const resp = await service.fetch(`http://internal${path}`, init);
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
