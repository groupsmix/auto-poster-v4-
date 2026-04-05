// ============================================================
// Unit Tests — Cache TTL and hash utilities
// ============================================================

import { describe, it, expect } from "vitest";
import { getCacheTTL, hashPrompt } from "@nexus/shared";

describe("getCacheTTL", () => {
  it("returns 3600 for research tasks (1 hour)", () => {
    expect(getCacheTTL("research")).toBe(3600);
  });

  it("returns 86400 for writing tasks (24 hours)", () => {
    expect(getCacheTTL("writing")).toBe(86400);
  });

  it("returns 21600 for seo tasks (6 hours)", () => {
    expect(getCacheTTL("seo")).toBe(21600);
  });

  it("returns 0 for review tasks (never cache)", () => {
    expect(getCacheTTL("review")).toBe(0);
  });

  it("returns 0 for image tasks (never cache)", () => {
    expect(getCacheTTL("image")).toBe(0);
  });

  it("returns 0 for unknown task types", () => {
    expect(getCacheTTL("unknown_task")).toBe(0);
  });

  it("returns 86400 for humanizer tasks", () => {
    expect(getCacheTTL("humanizer")).toBe(86400);
  });

  it("returns 86400 for variation tasks", () => {
    expect(getCacheTTL("variation")).toBe(86400);
  });

  it("returns 86400 for social tasks", () => {
    expect(getCacheTTL("social")).toBe(86400);
  });
});

describe("hashPrompt", () => {
  it("returns a string starting with cache:ai:", async () => {
    const hash = await hashPrompt("test prompt", "research");
    expect(hash).toMatch(/^cache:ai:[0-9a-f]{64}$/);
  });

  it("produces consistent hashes for the same input", async () => {
    const hash1 = await hashPrompt("hello world", "writing");
    const hash2 = await hashPrompt("hello world", "writing");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different prompts", async () => {
    const hash1 = await hashPrompt("prompt A", "research");
    const hash2 = await hashPrompt("prompt B", "research");
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for same prompt with different task types", async () => {
    const hash1 = await hashPrompt("same prompt", "research");
    const hash2 = await hashPrompt("same prompt", "writing");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty prompt string", async () => {
    const hash = await hashPrompt("", "research");
    expect(hash).toMatch(/^cache:ai:[0-9a-f]{64}$/);
  });

  it("handles long prompts", async () => {
    const longPrompt = "x".repeat(10000);
    const hash = await hashPrompt(longPrompt, "writing");
    expect(hash).toMatch(/^cache:ai:[0-9a-f]{64}$/);
  });
});
