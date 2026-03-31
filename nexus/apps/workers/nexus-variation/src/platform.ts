// ============================================================
// Platform Variation Engine
// Rewrites content per platform rules (Etsy, Gumroad, Shopify, etc.)
// Each platform has: title_max_chars, tag_count, tag_max_chars,
// audience, tone, seo_style, description_style, cta_style, forbidden
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";

// --- Types ---

export interface PlatformRules {
  name: string;
  slug: string;
  title_max_chars?: number;
  tag_count?: number;
  tag_max_chars?: number;
  audience?: string;
  tone?: string;
  seo_style?: string;
  description_style?: string;
  cta_style?: string;
  forbidden?: string[];
}

export interface BaseProduct {
  name: string;
  description: string;
  features?: string[];
  benefits?: string[];
  tags?: string[];
  price?: number;
  keywords?: string[];
  niche?: string;
  category?: string;
}

export interface PlatformVariant {
  platform: string;
  title: string;
  description: string;
  tags: string[];
  price: number;
  cta: string;
  notes: string;
}

// --- Default platform rules (fallback if KV empty) ---

const DEFAULT_PLATFORM_RULES: Record<string, PlatformRules> = {
  etsy: {
    name: "Etsy",
    slug: "etsy",
    title_max_chars: 140,
    tag_count: 13,
    tag_max_chars: 20,
    audience: "Handmade lovers, gift shoppers, small business owners",
    tone: "Warm, personal, gift-focused, emotional",
    seo_style: "Long-tail, buyer-intent keywords",
    description_style: "Story-driven, include: who it's for, what they get, how it helps",
    cta_style: "Save for later, Perfect gift for...",
    forbidden: ["best", "cheapest", "guaranteed"],
  },
  gumroad: {
    name: "Gumroad",
    slug: "gumroad",
    title_max_chars: 100,
    tag_count: 10,
    audience: "Creators, solopreneurs, freelancers",
    tone: "Value-driven, outcome-focused, creator-to-creator",
    seo_style: "Problem -> solution keywords",
    description_style: "What you get + what problem it solves + who it's for",
    cta_style: "Download instantly, Start using today",
  },
  shopify: {
    name: "Shopify",
    slug: "shopify",
    title_max_chars: 70,
    audience: "Brand-conscious buyers, direct traffic",
    tone: "Clean, brand-driven, professional",
    seo_style: "Short-tail + brand keywords",
    description_style: "Benefits-first, scannable bullets, trust signals",
  },
  redbubble: {
    name: "Redbubble",
    slug: "redbubble",
    title_max_chars: 60,
    tag_count: 15,
    audience: "Design lovers, pop culture fans, gift buyers",
    tone: "Fun, creative, trend-driven",
    description_style: "Design-first, playful, trendy language",
  },
  amazon_kdp: {
    name: "Amazon KDP",
    slug: "amazon_kdp",
    title_max_chars: 200,
    audience: "Readers, learners, professional development seekers",
    tone: "Authority-driven, educational, trustworthy",
    description_style: "Book-style blurb, author authority, what reader will learn",
  },
};

// --- Output schema for platform variant ---

const VARIANT_OUTPUT_SCHEMA = {
  title: "string (must respect platform char limit)",
  description: "string (platform-adapted, full rewrite)",
  tags: ["string (platform-optimized tags)"],
  price: "number",
  cta: "string (platform-appropriate call to action)",
  notes: "string (any platform-specific notes or recommendations)",
};

// --- Helper: call nexus-ai service binding ---

async function callAI(
  env: Env,
  prompt: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType: "variation", prompt }),
  });

  const json = (await response.json()) as ApiResponse<{
    result: string;
    model: string;
    cached: boolean;
    tokens?: number;
  }>;

  if (!json.success || !json.data) {
    throw new Error(`AI call failed: ${json.error ?? "Unknown error"}`);
  }

  return json.data;
}

// --- Helper: load platform rules from KV ---

async function loadPlatformRules(
  env: Env,
  platformSlug: string
): Promise<PlatformRules> {
  try {
    const resp = await env.NEXUS_STORAGE.fetch(
      `http://nexus-storage/kv/platform:${platformSlug}`
    );
    const json = (await resp.json()) as ApiResponse<PlatformRules>;
    if (json.success && json.data) {
      return { ...DEFAULT_PLATFORM_RULES[platformSlug], ...json.data };
    }
  } catch {
    // Fall through to defaults
  }

  const defaults = DEFAULT_PLATFORM_RULES[platformSlug];
  if (defaults) return defaults;

  return {
    name: platformSlug,
    slug: platformSlug,
    audience: "General online shoppers",
    tone: "Professional, clear",
  };
}

// --- Helper: parse AI response as JSON ---

function parseAIResponse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;
    }
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]) as Record<string, unknown>;
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

// --- Validation ---

function validateVariant(
  variant: PlatformVariant,
  rules: PlatformRules
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Title length
  if (rules.title_max_chars && variant.title.length > rules.title_max_chars) {
    issues.push(
      `Title exceeds ${rules.title_max_chars} chars (got ${variant.title.length})`
    );
    // Auto-truncate
    variant.title = variant.title.slice(0, rules.title_max_chars);
  }

  // Tag count
  if (rules.tag_count && variant.tags.length > rules.tag_count) {
    issues.push(
      `Too many tags: ${variant.tags.length} (max ${rules.tag_count})`
    );
    variant.tags = variant.tags.slice(0, rules.tag_count);
  }

  // Tag char length
  if (rules.tag_max_chars) {
    variant.tags = variant.tags.map((tag) =>
      tag.length > rules.tag_max_chars! ? tag.slice(0, rules.tag_max_chars!) : tag
    );
  }

  // Forbidden words
  if (rules.forbidden && rules.forbidden.length > 0) {
    const lowerTitle = variant.title.toLowerCase();
    const lowerDesc = variant.description.toLowerCase();
    for (const word of rules.forbidden) {
      const lowerWord = word.toLowerCase();
      if (lowerTitle.includes(lowerWord) || lowerDesc.includes(lowerWord)) {
        issues.push(`Contains forbidden word: "${word}"`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

// ============================================================
// PlatformVariationEngine
// ============================================================

export class PlatformVariationEngine {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Generate a platform-specific variant from base product content.
   */
  async generatePlatformVariant(
    baseProduct: BaseProduct,
    platformSlug: string
  ): Promise<{
    variant: PlatformVariant;
    model: string;
    cached: boolean;
    validation: { valid: boolean; issues: string[] };
  }> {
    const rules = await loadPlatformRules(this.env, platformSlug);

    // Build tag rules description
    const tagRules: string[] = [];
    if (rules.tag_count) tagRules.push(`Max ${rules.tag_count} tags`);
    if (rules.tag_max_chars) tagRules.push(`Max ${rules.tag_max_chars} chars per tag`);

    const prompt = `You are a top seller on ${rules.name} with $100K+ in revenue on this specific platform. You know exactly what converts on ${rules.name} — the buyer psychology, the algorithm, the tone, the SEO rules. You write listings that feel native to this platform, not adapted from somewhere else.

=== PLATFORM RULES ===
Platform: ${rules.name}
Audience: ${rules.audience ?? "General"}
Tone: ${rules.tone ?? "Professional"}
Title limit: ${rules.title_max_chars ?? "No limit"} characters (HARD LIMIT — never exceed)
Tag rules: ${tagRules.length > 0 ? tagRules.join(", ") : "No specific rules"}
SEO style: ${rules.seo_style ?? "Standard SEO"}
Description style: ${rules.description_style ?? "Clear, benefit-driven"}
CTA style: ${rules.cta_style ?? "Clear call to action"}
${rules.forbidden ? `Forbidden words (NEVER use): ${rules.forbidden.join(", ")}` : ""}

=== BEFORE YOU WRITE, THINK THROUGH THIS ===
1. Who is the typical ${rules.name} buyer? What are they looking for? How do they browse?
2. What tone and style converts best on ${rules.name}? (Don't just adapt — fully rewrite for this audience.)
3. What are the HARD constraints? (Character limits, tag counts, forbidden words — never violate these.)
4. What SEO approach does ${rules.name}'s algorithm reward?

=== TASK ===
Take this base product and COMPLETELY REWRITE it for ${rules.name}.
Do NOT copy the base listing. Each word must feel like a native ${rules.name} seller wrote it.
Front-load the primary keyword in the title. Use ALL available tag slots.
The description must match ${rules.name}'s buyer psychology and content style.

Base product:
${JSON.stringify(baseProduct, null, 2)}

Output: JSON matching this exact schema:
${JSON.stringify(VARIANT_OUTPUT_SCHEMA, null, 2)}`;

    const aiResult = await callAI(this.env, prompt);
    const parsed = parseAIResponse(aiResult.result);

    const variant: PlatformVariant = {
      platform: platformSlug,
      title: String(parsed.title ?? ""),
      description: String(parsed.description ?? ""),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map(String)
        : [],
      price: Number(parsed.price ?? baseProduct.price ?? 0),
      cta: String(parsed.cta ?? ""),
      notes: String(parsed.notes ?? ""),
    };

    const validation = validateVariant(variant, rules);

    if (validation.issues.length > 0) {
      console.warn(
        `[PLATFORM] Validation issues for ${platformSlug}:`,
        validation.issues
      );
    }

    return {
      variant,
      model: aiResult.model,
      cached: aiResult.cached,
      validation,
    };
  }

  /**
   * Generate variants for multiple platforms.
   * Runs in parallel per platform for speed.
   */
  async generateAllPlatformVariants(
    baseProduct: BaseProduct,
    platformSlugs: string[]
  ): Promise<{
    variants: PlatformVariant[];
    errors: Array<{ platform: string; error: string }>;
  }> {
    const results = await Promise.allSettled(
      platformSlugs.map((slug) =>
        this.generatePlatformVariant(baseProduct, slug)
      )
    );

    const variants: PlatformVariant[] = [];
    const errors: Array<{ platform: string; error: string }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        variants.push(result.value.variant);
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        errors.push({ platform: platformSlugs[i], error: message });
        console.error(
          `[PLATFORM] Failed to generate variant for ${platformSlugs[i]}:`,
          message
        );
      }
    }

    return { variants, errors };
  }
}
