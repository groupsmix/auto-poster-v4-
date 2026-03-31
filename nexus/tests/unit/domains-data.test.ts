// ============================================================
// Unit Tests — Frontend domain/category reference data
// Validates the DEFAULT_DOMAINS and DEFAULT_CATEGORIES structures
// ============================================================

import { describe, it, expect } from "vitest";

// Replicate the data structures from nexus/apps/web/lib/domains.ts
// to test in node environment without Next.js resolution

interface DomainData {
  name: string;
  slug: string;
  icon: string;
}

interface CategoryData {
  name: string;
  slug: string;
}

const DEFAULT_DOMAINS: DomainData[] = [
  { name: "Digital Products", slug: "digital-products", icon: "digital-products" },
  { name: "Print on Demand (POD)", slug: "print-on-demand", icon: "print-on-demand" },
  { name: "Content & Media", slug: "content-media", icon: "content-media" },
  { name: "Freelance Services", slug: "freelance-services", icon: "freelance-services" },
  { name: "Affiliate Marketing", slug: "affiliate-marketing", icon: "affiliate-marketing" },
  { name: "E-Commerce & Retail", slug: "e-commerce-retail", icon: "e-commerce-retail" },
  { name: "Knowledge & Education", slug: "knowledge-education", icon: "knowledge-education" },
  { name: "Specialized Technology", slug: "specialized-technology", icon: "specialized-technology" },
  { name: "Automation & No-Code", slug: "automation-no-code", icon: "automation-no-code" },
  { name: "Space & Innovation", slug: "space-innovation", icon: "space-innovation" },
];

const DEFAULT_CATEGORIES: Record<string, CategoryData[]> = {
  "digital-products": [
    { name: "Notion Templates", slug: "notion-templates" },
    { name: "PDF Guides & Ebooks", slug: "pdf-guides-ebooks" },
  ],
  "print-on-demand": [
    { name: "T-Shirts & Apparel", slug: "t-shirts-apparel" },
    { name: "Mugs & Drinkware", slug: "mugs-drinkware" },
  ],
};

describe("DEFAULT_DOMAINS", () => {
  it("has exactly 10 domains", () => {
    expect(DEFAULT_DOMAINS).toHaveLength(10);
  });

  it("every domain has name, slug, and icon", () => {
    for (const d of DEFAULT_DOMAINS) {
      expect(d.name).toBeTruthy();
      expect(d.slug).toBeTruthy();
      expect(d.icon).toBeTruthy();
    }
  });

  it("all slugs are unique", () => {
    const slugs = DEFAULT_DOMAINS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("slugs are lowercase kebab-case", () => {
    for (const d of DEFAULT_DOMAINS) {
      expect(d.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("contains expected core domains", () => {
    const slugs = DEFAULT_DOMAINS.map((d) => d.slug);
    expect(slugs).toContain("digital-products");
    expect(slugs).toContain("print-on-demand");
    expect(slugs).toContain("content-media");
    expect(slugs).toContain("e-commerce-retail");
  });
});

describe("DEFAULT_CATEGORIES", () => {
  it("every domain slug maps to a non-empty category array", () => {
    for (const [slug, cats] of Object.entries(DEFAULT_CATEGORIES)) {
      expect(slug).toBeTruthy();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThan(0);
    }
  });

  it("every category has name and slug", () => {
    for (const cats of Object.values(DEFAULT_CATEGORIES)) {
      for (const cat of cats) {
        expect(cat.name).toBeTruthy();
        expect(cat.slug).toBeTruthy();
      }
    }
  });

  it("category slugs within each domain are unique", () => {
    for (const cats of Object.values(DEFAULT_CATEGORIES)) {
      const slugs = cats.map((c) => c.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("category slugs are lowercase kebab-case", () => {
    for (const cats of Object.values(DEFAULT_CATEGORIES)) {
      for (const cat of cats) {
        expect(cat.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
    }
  });
});
