// ============================================================
// Unit Tests — calculateHealthScore & health scoring utilities
// ============================================================

import { describe, it, expect } from "vitest";
import { calculateHealthScore } from "@nexus/shared";

describe("calculateHealthScore", () => {
  it("returns 100 when no calls have been made", () => {
    expect(calculateHealthScore(0, 0)).toBe(100);
  });

  it("returns 100 when all calls succeed", () => {
    expect(calculateHealthScore(100, 0)).toBe(100);
  });

  it("returns 0 when all calls fail", () => {
    expect(calculateHealthScore(10, 10)).toBe(0);
  });

  it("returns 50 when half of calls fail", () => {
    expect(calculateHealthScore(100, 50)).toBe(50);
  });

  it("returns correct score for partial failures", () => {
    // 90 successes out of 100 calls = 90%
    expect(calculateHealthScore(100, 10)).toBe(90);
  });

  it("rounds to nearest integer", () => {
    // 2 failures out of 3 calls = 33.33...% -> 33
    expect(calculateHealthScore(3, 2)).toBe(33);
    // 1 failure out of 3 calls = 66.66...% -> 67
    expect(calculateHealthScore(3, 1)).toBe(67);
  });

  it("handles single call with success", () => {
    expect(calculateHealthScore(1, 0)).toBe(100);
  });

  it("handles single call with failure", () => {
    expect(calculateHealthScore(1, 1)).toBe(0);
  });

  it("handles large numbers", () => {
    expect(calculateHealthScore(1000000, 1000)).toBe(100); // 99.9% rounds to 100
    expect(calculateHealthScore(1000000, 100000)).toBe(90);
  });
});
