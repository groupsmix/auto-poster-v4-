// ============================================================
// Unit Tests — buildPromptForStep (9-layer prompt builder)
// ============================================================

import { describe, it, expect } from "vitest";
import {
  buildPromptForStep,
  getStepConfig,
  getOutputSchema,
  type ProductContext,
  type PromptTemplates,
  type StepName,
} from "../../apps/workers/nexus-workflow/src/steps";

function makeProduct(overrides: Partial<ProductContext> = {}): ProductContext {
  return {
    domain_slug: "digital-products",
    category_slug: "notion-templates",
    name: "Productivity Planner",
    niche: "productivity tools",
    language: "en",
    platforms: ["etsy", "gumroad"],
    social_channels: ["instagram"],
    ...overrides,
  };
}

function makeTemplates(overrides: Partial<PromptTemplates> = {}): PromptTemplates {
  return {
    master: "You are NEXUS, a product creation AI.",
    roles: {
      researcher: "You are a market researcher.",
      writer: "You are a copywriter.",
      seo_specialist: "You are an SEO expert.",
      designer: "You are a creative designer.",
      social_strategist: "You are a social media strategist.",
      quality_reviewer: "You are a quality reviewer.",
      humanizer: "You are a humanizer specialist.",
    },
    domains: {
      "digital-products": "Focus on digital product creation.",
    },
    categories: {
      "notion-templates": "Specialize in Notion templates.",
    },
    platforms: {
      etsy: "Follow Etsy listing guidelines.",
      gumroad: "Follow Gumroad product page best practices.",
    },
    ...overrides,
  };
}

describe("buildPromptForStep", () => {
  it("includes Layer A (master prompt)", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("=== SYSTEM INSTRUCTIONS ===");
    expect(prompt).toContain("You are NEXUS, a product creation AI.");
  });

  it("includes Layer B (role prompt)", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("=== YOUR ROLE ===");
    expect(prompt).toContain("You are a market researcher.");
  });

  it("includes Layer C (domain prompt)", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("=== DOMAIN CONTEXT ===");
    expect(prompt).toContain("Focus on digital product creation.");
  });

  it("includes Layer D (category prompt)", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("=== CATEGORY CONTEXT ===");
    expect(prompt).toContain("Specialize in Notion templates.");
  });

  it("includes Layer F (task prompt)", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("=== TASK ===");
  });

  it("includes Layer G (user input)", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("=== USER INPUT ===");
    expect(prompt).toContain("Language: en");
    expect(prompt).toContain("Niche: productivity tools");
    expect(prompt).toContain("Product Name: Productivity Planner");
  });

  it("includes Layer H (output schema)", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("=== OUTPUT FORMAT ===");
    expect(prompt).toContain("Respond with ONLY valid JSON");
  });

  it("includes platform info in user input", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("Target Platforms: etsy, gumroad");
  });

  it("includes social channels in user input", () => {
    const prompt = buildPromptForStep("research", makeProduct(), {}, makeTemplates());
    expect(prompt).toContain("Social Channels: instagram");
  });

  it("includes Layer I (context from prior steps) when provided", () => {
    const priorOutputs: Partial<Record<StepName, Record<string, unknown>>> = {
      research: {
        market_trends: ["trend1"],
        target_audience: "young creators",
      },
    };
    // strategy step uses research as context
    const prompt = buildPromptForStep(
      "strategy",
      makeProduct(),
      priorOutputs,
      makeTemplates()
    );
    expect(prompt).toContain("=== CONTEXT FROM PRIOR STEPS ===");
    expect(prompt).toContain("trend1");
    expect(prompt).toContain("young creators");
  });

  it("includes revision feedback when provided", () => {
    const prompt = buildPromptForStep(
      "content_generation",
      makeProduct(),
      {},
      makeTemplates(),
      "Title needs to be more catchy"
    );
    expect(prompt).toContain("CEO Revision Feedback");
    expect(prompt).toContain("Title needs to be more catchy");
    expect(prompt).toContain("Address ALL feedback points");
  });

  it("omits Layer C when domain template is missing", () => {
    const templates = makeTemplates({ domains: {} });
    const prompt = buildPromptForStep("research", makeProduct(), {}, templates);
    expect(prompt).not.toContain("=== DOMAIN CONTEXT ===");
  });

  it("omits Layer D when category template is missing", () => {
    const templates = makeTemplates({ categories: {} });
    const prompt = buildPromptForStep("research", makeProduct(), {}, templates);
    expect(prompt).not.toContain("=== CATEGORY CONTEXT ===");
  });

  it("includes custom user_input fields", () => {
    const product = makeProduct({
      user_input: { color_theme: "blue", style: "minimalist" },
    });
    const prompt = buildPromptForStep("research", product, {}, makeTemplates());
    expect(prompt).toContain("color_theme: blue");
    expect(prompt).toContain("style: minimalist");
  });
});

describe("getStepConfig", () => {
  it("returns config for all 9 steps", () => {
    const steps: StepName[] = [
      "research",
      "strategy",
      "content_generation",
      "seo_optimization",
      "image_generation",
      "platform_variants",
      "social_content",
      "humanizer_pass",
      "quality_review",
    ];
    for (const step of steps) {
      const config = getStepConfig(step);
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.taskType).toBeTruthy();
      expect(config.role).toBeTruthy();
    }
  });
});

describe("getOutputSchema", () => {
  it("returns schema for research step", () => {
    const schema = getOutputSchema("research");
    expect(schema).toBeDefined();
    expect(schema).toHaveProperty("market_trends");
    expect(schema).toHaveProperty("target_audience");
  });

  it("returns schema for quality_review step", () => {
    const schema = getOutputSchema("quality_review");
    expect(schema).toBeDefined();
    expect(schema).toHaveProperty("overall_score");
  });
});
