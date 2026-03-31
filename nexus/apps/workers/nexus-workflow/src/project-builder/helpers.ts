// ============================================================
// Project Builder — Shared helpers
// Service client helpers and utility functions
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";
import { now } from "@nexus/shared";

// --- Helper: call nexus-storage D1 queries ---

export async function storageQuery<T = unknown>(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const response = await env.NEXUS_STORAGE.fetch(
    "http://nexus-storage/d1/query",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }
  );
  const json = (await response.json()) as ApiResponse;
  if (!json.success) {
    throw new Error(`Storage query failed: ${json.error ?? "Unknown error"}`);
  }
  return json.data as T;
}

// --- Helper: call nexus-ai service binding ---

export async function callAI(
  env: Env,
  taskType: string,
  prompt: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType, prompt }),
  });

  const json = (await response.json()) as ApiResponse<{
    result: string;
    model: string;
    cached: boolean;
    tokens?: number;
  }>;

  if (!json.success || !json.data) {
    throw new Error(`AI call failed: ${json.error ?? "Unknown error"}`);
  }

  return json.data;
}

// --- Helper: parse AI JSON response ---

export function parseAIResponse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Try extracting from markdown code blocks
  }

  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // continue
    }
  }

  // Find balanced JSON object
  const startIdx = raw.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(raw.slice(startIdx, i + 1)) as Record<string, unknown>;
          } catch {
            break;
          }
        }
      }
    }
  }

  const preview = raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
  throw new Error(`Failed to parse AI response as JSON. Preview: ${preview}`);
}

// --- Step timeout ---

export const STEP_TIMEOUT_MS = 5 * 60 * 1000;

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// --- Helper: update build record ---

export async function updateBuild(
  env: Env,
  buildId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`"${key}" = ?`);
    values.push(value);
  }

  setClauses.push('"updated_at" = ?');
  values.push(now());
  values.push(buildId);

  await storageQuery(
    env,
    `UPDATE project_builds SET ${setClauses.join(", ")} WHERE id = ?`,
    values
  );
}

// --- Helper: update step by agent ---

export async function updateStepByAgent(
  env: Env,
  buildId: string,
  agentRole: string,
  cycle: number,
  fields: Record<string, unknown>
): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`"${key}" = ?`);
    values.push(value);
  }

  values.push(buildId, agentRole, cycle);

  await storageQuery(
    env,
    `UPDATE project_build_steps SET ${setClauses.join(", ")} WHERE build_id = ? AND agent_role = ? AND cycle = ?`,
    values
  );
}

// --- Helper: check cancellation ---

export async function isCancelled(env: Env, buildId: string): Promise<boolean> {
  const result = (await storageQuery(
    env,
    "SELECT status FROM project_builds WHERE id = ?",
    [buildId]
  )) as { results?: Array<{ status: string }> };
  return result?.results?.[0]?.status === "cancelled";
}
