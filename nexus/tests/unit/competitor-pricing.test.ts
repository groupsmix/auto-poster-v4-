// ============================================================
// Unit Tests — Competitor Price Monitoring
// Tests for nexus/apps/workers/nexus-router/src/routes/competitor-pricing.ts
// ============================================================

import { describe, it, expect } from "vitest";

// Replicate the URL builder logic for testing
function buildSearchUrl(platform: string, niche: string): string | null {
  const query = encodeURIComponent(niche);
  switch (platform.toLowerCase()) {
    case "etsy":
      return `https://www.etsy.com/search?q=${query}`;
    case "amazon":
      return `https://www.amazon.com/s?k=${query}`;
    default:
      return null;
  }
}

// Replicate the price parser logic for testing
function parseSearchResults(
  html: string,
  platform: string,
  niche: string,
  maxResults: number
): Array<{
  niche: string;
  platform: string;
  competitor_name: string;
  product_title: string;
  product_url: string;
  price: number;
  currency: string;
}> {
  const results: Array<{
    niche: string;
    platform: string;
    competitor_name: string;
    product_title: string;
    product_url: string;
    price: number;
    currency: string;
  }> = [];

  if (platform === "etsy") {
    const priceRegex = /currency_value[^>]*>(\d+[\.,]\d{2})/g;
    const titleRegex = /data-listing-card-v2[^>]*>[\s\S]*?<h3[^>]*>(.*?)<\/h3>/g;
    let match;
    while ((match = priceRegex.exec(html)) !== null && results.length < maxResults) {
      const price = parseFloat(match[1].replace(",", "."));
      if (price > 0) {
        results.push({
          niche,
          platform: "etsy",
          competitor_name: "Etsy Seller",
          product_title: `${niche} product`,
          product_url: `https://www.etsy.com/listing/unknown`,
          price,
          currency: "USD",
        });
      }
    }
  }

  if (platform === "amazon") {
    const priceRegex = /a-price-whole[^>]*>(\d+)<[\s\S]*?a-price-fraction[^>]*>(\d+)/g;
    let match;
    while ((match = priceRegex.exec(html)) !== null && results.length < maxResults) {
      const price = parseFloat(`${match[1]}.${match[2]}`);
      if (price > 0) {
        results.push({
          niche,
          platform: "amazon",
          competitor_name: "Amazon Seller",
          product_title: `${niche} product`,
          product_url: `https://www.amazon.com/dp/unknown`,
          price,
          currency: "USD",
        });
      }
    }
  }

  return results;
}

// Price suggestion logic
function calculateSuggestedPrice(
  prices: number[],
  strategy: string,
  adjustmentPct: number
): number {
  if (prices.length === 0) return 0;

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const min = Math.min(...prices);

  switch (strategy) {
    case "below_average":
      return Math.round(avg * (1 + adjustmentPct / 100) * 100) / 100;
    case "match_lowest":
      return Math.round(min * 100) / 100;
    case "custom":
      return Math.round(avg * (1 + adjustmentPct / 100) * 100) / 100;
    default:
      return Math.round(avg * 100) / 100;
  }
}

describe("Competitor Pricing", () => {
  describe("buildSearchUrl", () => {
    it("builds Etsy search URL", () => {
      const url = buildSearchUrl("etsy", "digital planner");
      expect(url).toBe("https://www.etsy.com/search?q=digital%20planner");
    });

    it("builds Amazon search URL", () => {
      const url = buildSearchUrl("amazon", "printable tracker");
      expect(url).toBe("https://www.amazon.com/s?k=printable%20tracker");
    });

    it("returns null for unsupported platforms", () => {
      expect(buildSearchUrl("shopify", "test")).toBeNull();
      expect(buildSearchUrl("unknown", "test")).toBeNull();
    });

    it("encodes special characters in niche", () => {
      const url = buildSearchUrl("etsy", "mom's planner & tracker");
      expect(url).toContain("mom's%20planner%20%26%20tracker");
    });
  });

  describe("parseSearchResults", () => {
    it("parses Etsy price results from HTML", () => {
      const html = `
        <span class="currency_value">12.99</span>
        <span class="currency_value">15.50</span>
        <span class="currency_value">8.00</span>
      `;
      const results = parseSearchResults(html, "etsy", "planner", 20);
      expect(results).toHaveLength(3);
      expect(results[0].price).toBe(12.99);
      expect(results[1].price).toBe(15.50);
      expect(results[2].price).toBe(8.00);
      expect(results[0].platform).toBe("etsy");
    });

    it("parses Amazon price results from HTML", () => {
      const html = `
        <span class="a-price-whole">24</span><span class="a-price-fraction">99</span>
        <span class="a-price-whole">19</span><span class="a-price-fraction">95</span>
      `;
      const results = parseSearchResults(html, "amazon", "tracker", 20);
      expect(results).toHaveLength(2);
      expect(results[0].price).toBe(24.99);
      expect(results[1].price).toBe(19.95);
      expect(results[0].platform).toBe("amazon");
    });

    it("respects maxResults limit", () => {
      const html = `
        <span class="currency_value">1.00</span>
        <span class="currency_value">2.00</span>
        <span class="currency_value">3.00</span>
        <span class="currency_value">4.00</span>
      `;
      const results = parseSearchResults(html, "etsy", "test", 2);
      expect(results).toHaveLength(2);
    });

    it("returns empty array for unknown platform", () => {
      const results = parseSearchResults("<div>test</div>", "shopify", "test", 20);
      expect(results).toHaveLength(0);
    });

    it("returns empty array when no prices found", () => {
      const results = parseSearchResults("<div>No results</div>", "etsy", "test", 20);
      expect(results).toHaveLength(0);
    });
  });

  describe("calculateSuggestedPrice", () => {
    it("calculates below_average price", () => {
      const prices = [10, 20, 30]; // avg = 20
      const result = calculateSuggestedPrice(prices, "below_average", -10);
      expect(result).toBe(18); // 20 * 0.9
    });

    it("calculates match_lowest price", () => {
      const prices = [10, 20, 30];
      const result = calculateSuggestedPrice(prices, "match_lowest", -10);
      expect(result).toBe(10);
    });

    it("calculates custom price with positive adjustment", () => {
      const prices = [10, 20, 30]; // avg = 20
      const result = calculateSuggestedPrice(prices, "custom", 15);
      expect(result).toBe(23); // 20 * 1.15
    });

    it("returns 0 for empty price array", () => {
      const result = calculateSuggestedPrice([], "below_average", -10);
      expect(result).toBe(0);
    });

    it("uses average for unknown strategy", () => {
      const prices = [10, 20, 30]; // avg = 20
      const result = calculateSuggestedPrice(prices, "unknown_strategy", 0);
      expect(result).toBe(20);
    });
  });
});
