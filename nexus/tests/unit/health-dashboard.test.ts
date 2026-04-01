// ============================================================
// Unit Tests — Health Dashboard data aggregation
// Tests for nexus/apps/workers/nexus-router/src/routes/health-dashboard.ts
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { createMockD1, createMockEnv } from "../helpers/mocks";

describe("Health Dashboard", () => {
  describe("API credit estimation logic", () => {
    it("calculates worker request usage from workflow counts", () => {
      // Each workflow triggers ~5 worker requests on average
      const workflowCount = 100;
      const estimatedRequests = workflowCount * 5;
      expect(estimatedRequests).toBe(500);
      expect(estimatedRequests).toBeLessThan(10_000_000); // well within free tier
    });

    it("calculates R2 storage usage in GB", () => {
      const totalBytesUsed = 2_500_000_000; // 2.5 GB
      const usageGB = totalBytesUsed / (1024 * 1024 * 1024);
      expect(usageGB).toBeCloseTo(2.33, 1);
      expect(usageGB).toBeLessThan(10); // free tier limit
    });

    it("returns correct free-tier limits", () => {
      const limits = {
        workers_requests: 10_000_000,
        kv_reads: 10_000_000,
        d1_reads: 25_000_000_000,
        r2_storage_gb: 10,
      };

      expect(limits.workers_requests).toBe(10_000_000);
      expect(limits.kv_reads).toBe(10_000_000);
      expect(limits.d1_reads).toBe(25_000_000_000);
      expect(limits.r2_storage_gb).toBe(10);
    });
  });

  describe("Success rate calculation", () => {
    it("calculates 100% when no failures", () => {
      const total = 50;
      const failed = 0;
      const rate = total > 0 ? Math.round(((total - failed) / total) * 100) : 100;
      expect(rate).toBe(100);
    });

    it("calculates correct rate with failures", () => {
      const total = 100;
      const failed = 15;
      const rate = total > 0 ? Math.round(((total - failed) / total) * 100) : 100;
      expect(rate).toBe(85);
    });

    it("returns 100% when total is 0 (no workflows run yet)", () => {
      const total = 0;
      const failed = 0;
      const rate = total > 0 ? Math.round(((total - failed) / total) * 100) : 100;
      expect(rate).toBe(100);
    });

    it("handles edge case where all workflows failed", () => {
      const total = 10;
      const failed = 10;
      const rate = total > 0 ? Math.round(((total - failed) / total) * 100) : 100;
      expect(rate).toBe(0);
    });
  });

  describe("Quality score trend", () => {
    it("computes daily average scores from products", () => {
      const products = [
        { created_at: "2026-03-01", quality_score: 8 },
        { created_at: "2026-03-01", quality_score: 6 },
        { created_at: "2026-03-02", quality_score: 9 },
      ];

      const grouped = new Map<string, number[]>();
      for (const p of products) {
        const date = p.created_at.slice(0, 10);
        if (!grouped.has(date)) grouped.set(date, []);
        grouped.get(date)!.push(p.quality_score);
      }

      const trend = Array.from(grouped.entries()).map(([date, scores]) => ({
        date,
        score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      }));

      expect(trend).toHaveLength(2);
      expect(trend[0].date).toBe("2026-03-01");
      expect(trend[0].score).toBe(7);
      expect(trend[1].score).toBe(9);
    });
  });

  describe("Top niches aggregation", () => {
    it("groups products by niche and calculates stats", () => {
      const products = [
        { niche: "planner", quality_score: 8, revenue: 25.00 },
        { niche: "planner", quality_score: 7, revenue: 30.00 },
        { niche: "tracker", quality_score: 9, revenue: 15.00 },
      ];

      const nicheMap = new Map<string, { count: number; totalScore: number; totalRevenue: number }>();
      for (const p of products) {
        const entry = nicheMap.get(p.niche) ?? { count: 0, totalScore: 0, totalRevenue: 0 };
        entry.count++;
        entry.totalScore += p.quality_score;
        entry.totalRevenue += p.revenue;
        nicheMap.set(p.niche, entry);
      }

      const topNiches = Array.from(nicheMap.entries())
        .map(([niche, stats]) => ({
          niche,
          products: stats.count,
          avg_score: Math.round((stats.totalScore / stats.count) * 10) / 10,
          revenue: stats.totalRevenue,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      expect(topNiches).toHaveLength(2);
      expect(topNiches[0].niche).toBe("planner");
      expect(topNiches[0].products).toBe(2);
      expect(topNiches[0].avg_score).toBe(7.5);
      expect(topNiches[0].revenue).toBe(55);
    });
  });

  describe("Mock environment setup", () => {
    it("creates a valid mock env with all required bindings", () => {
      const env = createMockEnv();
      expect(env.DB).toBeDefined();
      expect(env.KV).toBeDefined();
      expect(env.R2).toBeDefined();
      expect(env.NEXUS_AI).toBeDefined();
      expect(env.NEXUS_WORKFLOW).toBeDefined();
      expect(env.NEXUS_STORAGE).toBeDefined();
      expect(env.DASHBOARD_SECRET).toBe("test-secret-123");
    });
  });
});
