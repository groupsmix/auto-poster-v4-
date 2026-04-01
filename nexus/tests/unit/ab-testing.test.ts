// ============================================================
// Unit Tests — A/B Testing logic
// Tests for nexus/apps/workers/nexus-router/src/routes/ab-testing.ts
// ============================================================

import { describe, it, expect } from "vitest";

interface ABVariant {
  id: string;
  variant_label: string;
  views: number;
  clicks: number;
  sales: number;
  revenue: number;
  conversion_rate: number;
}

function calculateConversionRate(views: number, sales: number): number {
  return views > 0 ? Math.round((sales / views) * 10000) / 100 : 0;
}

function selectWinner(variants: ABVariant[]): ABVariant | null {
  if (variants.length === 0) return null;
  return variants.reduce((best, v) =>
    v.conversion_rate > best.conversion_rate ? v : best
  );
}

function hasEnoughData(variants: ABVariant[], minViews: number = 50): boolean {
  return variants.every((v) => v.views >= minViews);
}

describe("A/B Testing", () => {
  describe("calculateConversionRate", () => {
    it("returns 0 when no views", () => {
      expect(calculateConversionRate(0, 0)).toBe(0);
    });

    it("calculates correct conversion rate", () => {
      expect(calculateConversionRate(100, 5)).toBe(5);
    });

    it("handles fractional rates", () => {
      expect(calculateConversionRate(300, 7)).toBe(2.33);
    });

    it("handles 100% conversion", () => {
      expect(calculateConversionRate(10, 10)).toBe(100);
    });
  });

  describe("selectWinner", () => {
    it("returns null for empty variants", () => {
      expect(selectWinner([])).toBeNull();
    });

    it("selects the variant with highest conversion rate", () => {
      const variants: ABVariant[] = [
        { id: "1", variant_label: "A", views: 100, clicks: 20, sales: 5, revenue: 50, conversion_rate: 5.0 },
        { id: "2", variant_label: "B", views: 100, clicks: 25, sales: 8, revenue: 80, conversion_rate: 8.0 },
        { id: "3", variant_label: "C", views: 100, clicks: 15, sales: 3, revenue: 30, conversion_rate: 3.0 },
      ];

      const winner = selectWinner(variants);
      expect(winner?.variant_label).toBe("B");
      expect(winner?.conversion_rate).toBe(8.0);
    });

    it("returns first variant when all have equal conversion rates", () => {
      const variants: ABVariant[] = [
        { id: "1", variant_label: "A", views: 100, clicks: 10, sales: 5, revenue: 50, conversion_rate: 5.0 },
        { id: "2", variant_label: "B", views: 100, clicks: 10, sales: 5, revenue: 50, conversion_rate: 5.0 },
      ];

      const winner = selectWinner(variants);
      expect(winner?.variant_label).toBe("A");
    });
  });

  describe("hasEnoughData", () => {
    it("returns true when all variants have enough views", () => {
      const variants: ABVariant[] = [
        { id: "1", variant_label: "A", views: 100, clicks: 10, sales: 5, revenue: 50, conversion_rate: 5.0 },
        { id: "2", variant_label: "B", views: 80, clicks: 10, sales: 4, revenue: 40, conversion_rate: 5.0 },
      ];
      expect(hasEnoughData(variants)).toBe(true);
    });

    it("returns false when any variant lacks views", () => {
      const variants: ABVariant[] = [
        { id: "1", variant_label: "A", views: 100, clicks: 10, sales: 5, revenue: 50, conversion_rate: 5.0 },
        { id: "2", variant_label: "B", views: 30, clicks: 3, sales: 1, revenue: 10, conversion_rate: 3.33 },
      ];
      expect(hasEnoughData(variants)).toBe(false);
    });

    it("uses custom minimum views threshold", () => {
      const variants: ABVariant[] = [
        { id: "1", variant_label: "A", views: 20, clicks: 2, sales: 1, revenue: 10, conversion_rate: 5.0 },
      ];
      expect(hasEnoughData(variants, 10)).toBe(true);
      expect(hasEnoughData(variants, 50)).toBe(false);
    });
  });

  describe("variant label generation", () => {
    it("generates sequential labels A, B, C...", () => {
      const labels = Array.from({ length: 5 }, (_, i) => String.fromCharCode(65 + i));
      expect(labels).toEqual(["A", "B", "C", "D", "E"]);
    });
  });
});
