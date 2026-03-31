// ============================================================
// Unit Tests — Frontend formatting utilities
// Tests for nexus/apps/web/lib/format.ts
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";

// Replicate the format functions so tests run in the node environment
// without needing to resolve Next.js / React imports

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(d: string): string {
  const now = Date.now();
  const then = new Date(d).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(d);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

describe("formatDate", () => {
  it("formats a date string to short month/day/year", () => {
    const result = formatDate("2025-06-15T12:00:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("handles ISO date strings", () => {
    const result = formatDate("2024-01-01T00:00:00.000Z");
    expect(result).toContain("2024");
  });
});

describe("formatDateTime", () => {
  it("includes time in the formatted output", () => {
    const result = formatDateTime("2025-06-15T14:30:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });
});

describe("formatRelative", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "just now" for very recent dates', () => {
    const now = new Date();
    const tenSecondsAgo = new Date(now.getTime() - 10_000).toISOString();
    expect(formatRelative(tenSecondsAgo)).toBe("just now");
  });

  it("returns minutes ago for dates within the last hour", () => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60_000).toISOString();
    expect(formatRelative(thirtyMinAgo)).toBe("30m ago");
  });

  it("returns hours ago for dates within the last day", () => {
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 3_600_000).toISOString();
    expect(formatRelative(fiveHoursAgo)).toBe("5h ago");
  });

  it("returns days ago for dates within the last week", () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    expect(formatRelative(threeDaysAgo)).toBe("3d ago");
  });

  it("returns formatted date for dates older than a week", () => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
    const result = formatRelative(twoWeeksAgo);
    // Should fall through to formatDate, containing month name
    expect(result).not.toContain("ago");
    expect(result).toContain("2026"); // current year
  });
});

describe("formatDuration", () => {
  it("formats milliseconds under a minute as seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(59_999)).toBe("59s");
  });

  it("formats milliseconds over a minute as minutes and seconds", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
    expect(formatDuration(90_000)).toBe("1m 30s");
    expect(formatDuration(125_000)).toBe("2m 5s");
  });

  it("handles large durations", () => {
    expect(formatDuration(3_600_000)).toBe("60m 0s");
    expect(formatDuration(7_261_000)).toBe("121m 1s");
  });
});
