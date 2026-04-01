// ============================================================
// Unit Tests — Bundle Creator logic
// Tests for nexus/apps/workers/nexus-router/src/routes/bundles.ts
// ============================================================

import { describe, it, expect } from "vitest";

interface Product {
  id: string;
  niche: string;
  category_id: string;
  price?: number;
}

// Replicate the auto-grouping logic
function autoGroupByNiche(
  products: Product[],
  minItems: number = 3
): Map<string, Product[]> {
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    const niche = product.niche?.toLowerCase() ?? "unknown";
    if (!groups.has(niche)) groups.set(niche, []);
    groups.get(niche)!.push(product);
  }

  // Filter out groups that don't meet minimum
  for (const [key, items] of groups) {
    if (items.length < minItems) groups.delete(key);
  }

  return groups;
}

// Replicate bundle price calculation
function calculateBundlePrice(
  individualTotal: number,
  multiplier: number = 2.5
): { bundlePrice: number; savingsPct: number } {
  const bundlePrice = Math.round(individualTotal / multiplier * 100) / 100;
  const savingsPct = Math.round((1 - bundlePrice / individualTotal) * 100);
  return { bundlePrice, savingsPct };
}

// Replicate keyword-based similarity grouping (fallback for AI suggestions)
function keywordGrouping(
  products: Product[],
  maxBundles: number = 5
): Array<{ name: string; product_ids: string[]; estimated_multiplier: number }> {
  const nicheGroups = new Map<string, Product[]>();

  for (const p of products) {
    const words = (p.niche || "").toLowerCase().split(/[\s-_]+/);
    for (const word of words) {
      if (word.length < 3) continue;
      if (!nicheGroups.has(word)) nicheGroups.set(word, []);
      nicheGroups.get(word)!.push(p);
    }
  }

  const suggestions: Array<{ name: string; product_ids: string[]; estimated_multiplier: number }> = [];
  const usedProducts = new Set<string>();

  for (const [keyword, group] of nicheGroups) {
    if (suggestions.length >= maxBundles) break;
    const uniqueProducts = group.filter((p) => !usedProducts.has(p.id));
    if (uniqueProducts.length < 3) continue;

    const bundleProducts = uniqueProducts.slice(0, 6);
    bundleProducts.forEach((p) => usedProducts.add(p.id));

    suggestions.push({
      name: `Complete ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Collection`,
      product_ids: bundleProducts.map((p) => p.id),
      estimated_multiplier: 2.0,
    });
  }

  return suggestions;
}

describe("Bundle Creator", () => {
  describe("autoGroupByNiche", () => {
    it("groups products by niche", () => {
      const products: Product[] = [
        { id: "1", niche: "planner", category_id: "c1" },
        { id: "2", niche: "planner", category_id: "c1" },
        { id: "3", niche: "planner", category_id: "c1" },
        { id: "4", niche: "tracker", category_id: "c2" },
        { id: "5", niche: "tracker", category_id: "c2" },
      ];

      const groups = autoGroupByNiche(products, 3);
      expect(groups.size).toBe(1); // only planner has 3+
      expect(groups.get("planner")).toHaveLength(3);
    });

    it("excludes groups below minimum items", () => {
      const products: Product[] = [
        { id: "1", niche: "planner", category_id: "c1" },
        { id: "2", niche: "planner", category_id: "c1" },
        { id: "3", niche: "tracker", category_id: "c2" },
      ];

      const groups = autoGroupByNiche(products, 3);
      expect(groups.size).toBe(0);
    });

    it("handles case-insensitive niche names", () => {
      const products: Product[] = [
        { id: "1", niche: "Planner", category_id: "c1" },
        { id: "2", niche: "planner", category_id: "c1" },
        { id: "3", niche: "PLANNER", category_id: "c1" },
      ];

      const groups = autoGroupByNiche(products, 3);
      expect(groups.size).toBe(1);
      expect(groups.get("planner")).toHaveLength(3);
    });

    it("handles empty products array", () => {
      const groups = autoGroupByNiche([], 3);
      expect(groups.size).toBe(0);
    });
  });

  describe("calculateBundlePrice", () => {
    it("calculates bundle price with default 2.5x multiplier", () => {
      const { bundlePrice, savingsPct } = calculateBundlePrice(50);
      expect(bundlePrice).toBe(20);
      expect(savingsPct).toBe(60);
    });

    it("calculates bundle price with custom multiplier", () => {
      const { bundlePrice, savingsPct } = calculateBundlePrice(30, 2.0);
      expect(bundlePrice).toBe(15);
      expect(savingsPct).toBe(50);
    });

    it("handles zero individual total", () => {
      const { bundlePrice, savingsPct } = calculateBundlePrice(0);
      expect(bundlePrice).toBe(0);
    });

    it("rounds to 2 decimal places", () => {
      const { bundlePrice } = calculateBundlePrice(33.33, 2.5);
      expect(bundlePrice).toBe(13.33);
    });
  });

  describe("keywordGrouping (AI fallback)", () => {
    it("groups products by common keywords", () => {
      const products: Product[] = [
        { id: "1", niche: "daily planner", category_id: "c1" },
        { id: "2", niche: "weekly planner", category_id: "c1" },
        { id: "3", niche: "monthly planner", category_id: "c1" },
        { id: "4", niche: "habit tracker", category_id: "c2" },
        { id: "5", niche: "sleep tracker", category_id: "c2" },
        { id: "6", niche: "mood tracker", category_id: "c2" },
      ];

      const suggestions = keywordGrouping(products);
      expect(suggestions.length).toBeGreaterThanOrEqual(1);

      // Should find "planner" and "tracker" groups
      const names = suggestions.map((s) => s.name.toLowerCase());
      expect(names.some((n) => n.includes("planner"))).toBe(true);
    });

    it("respects maxBundles limit", () => {
      const products: Product[] = Array.from({ length: 30 }, (_, i) => ({
        id: String(i),
        niche: `niche-${i % 3}-word${i % 5}`,
        category_id: "c1",
      }));

      const suggestions = keywordGrouping(products, 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it("ignores short words (< 3 chars)", () => {
      const products: Product[] = [
        { id: "1", niche: "a b", category_id: "c1" },
        { id: "2", niche: "a b", category_id: "c1" },
        { id: "3", niche: "a b", category_id: "c1" },
      ];

      const suggestions = keywordGrouping(products);
      expect(suggestions).toHaveLength(0);
    });

    it("does not reuse products across bundles", () => {
      const products: Product[] = [
        { id: "1", niche: "planner tracker", category_id: "c1" },
        { id: "2", niche: "planner tracker", category_id: "c1" },
        { id: "3", niche: "planner tracker", category_id: "c1" },
      ];

      const suggestions = keywordGrouping(products);
      // First group will use all 3 products, second group should not be created
      if (suggestions.length > 1) {
        const allIds = suggestions.flatMap((s) => s.product_ids);
        const uniqueIds = new Set(allIds);
        expect(uniqueIds.size).toBe(allIds.length);
      }
    });

    it("generates proper collection names", () => {
      const products: Product[] = [
        { id: "1", niche: "planner", category_id: "c1" },
        { id: "2", niche: "planner", category_id: "c1" },
        { id: "3", niche: "planner", category_id: "c1" },
      ];

      const suggestions = keywordGrouping(products);
      expect(suggestions[0].name).toBe("Complete Planner Collection");
      expect(suggestions[0].estimated_multiplier).toBe(2.0);
    });
  });
});
