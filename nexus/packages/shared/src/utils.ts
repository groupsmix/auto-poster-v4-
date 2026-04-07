// ============================================================
// NEXUS Shared Utilities
// ============================================================

import { CACHE_TTL_MAP } from "./constants";
import type { TaskType } from "./types";

/**
 * Generate a unique ID (UUID v4)
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a URL-safe slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * SHA-256 hash for AI response cache keys.
 * Returns the full cache key in format: cache:ai:{hex}
 */
export async function hashPrompt(
  prompt: string,
  taskType: string
): Promise<string> {
  const data = new TextEncoder().encode(prompt + taskType);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `cache:ai:${hex}`;
}

/**
 * Get cache TTL for a given task type (in seconds).
 * Returns 0 for unknown task types (no caching).
 */
export function getCacheTTL(taskType: string): number {
  return CACHE_TTL_MAP[taskType as TaskType] ?? 0;
}

/**
 * Calculate AI model health score (0-100) based on call history.
 * Returns 100 if no calls have been made yet.
 */
export function calculateHealthScore(
  totalCalls: number,
  totalFailures: number
): number {
  if (totalCalls === 0) return 100;
  return Math.round(((totalCalls - totalFailures) / totalCalls) * 100);
}

/**
 * Get unix timestamp (ms) for the next midnight UTC.
 * Used for daily AI rate limit resets.
 */
export function getMidnightTimestamp(): number {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.getTime();
}

/**
 * Get current ISO datetime string
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse an AI response string as JSON.
 * Tries three strategies in order:
 *   1. Direct JSON.parse
 *   2. Extract from markdown ```json ... ``` code blocks
 *   3. Find balanced JSON object using bracket counting
 *
 * This is the single source of truth — all workers should use this
 * instead of maintaining their own copy.
 */
export function parseAIJSON(raw: string): Record<string, unknown> {
  // Strategy 1: Direct JSON.parse
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // continue
  }

  // Strategy 2: Extract from markdown code blocks
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    try {
      const content = jsonMatch[1].trim();
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      // continue to see if we can repair or find another block
    }
  }

  // Strategy 3: Find balanced JSON object with bracket counting & repair
  // This version is more robust: it tries ALL { } blocks if the first one fails
  const allIndices: number[] = [];
  let pos = raw.indexOf("{");
  while (pos !== -1) {
    allIndices.push(pos);
    pos = raw.indexOf("{", pos + 1);
  }

  for (const startIdx of allIndices) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          let candidate = raw.slice(startIdx, i + 1);
          try {
            return JSON.parse(candidate) as Record<string, unknown>;
          } catch {
            // Attempt extreme repair: some models don't escape newlines in long strings
            try {
              // Replace unescaped newlines inside the JSON string (this is naive but often works)
              const repaired = candidate.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
              return JSON.parse(repaired) as Record<string, unknown>;
            } catch {
              // move to next startIdx
            }
          }
        }
      }
    }
  }

  // Strategy 4: Last resort — just try to find the biggest {} block and strip junk
  try {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const block = raw.slice(firstBrace, lastBrace + 1);
      // Clean control characters that break JSON.parse
      const cleaned = block.replace(/[\x00-\x1F\x7F-\x9F]/g, (match) => {
        if (match === "\n") return "\\n";
        if (match === "\r") return "\\r";
        if (match === "\t") return "\\t";
        return "";
      });
      return JSON.parse(cleaned) as Record<string, unknown>;
    }
  } catch {
    // failure
  }

  // All strategies failed
  const preview = raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
  throw new Error(
    `Failed to parse AI response as JSON. Raw response preview: ${preview}`
  );
}
