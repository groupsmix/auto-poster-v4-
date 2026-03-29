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
 * Build a cache key for AI responses
 */
export function buildCacheKey(hash: string): string {
  return `cache:ai:${hash}`;
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
