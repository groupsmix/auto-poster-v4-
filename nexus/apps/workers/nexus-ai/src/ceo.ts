// ============================================================
// AI CEO / Auto-Orchestrator — Niche Analysis & Prompt Generation
//
// When a user creates a new domain + category, the AI CEO:
// 1. Deeply analyzes the niche (market, audience, competition)
// 2. Generates expert-level prompt templates tailored to that niche
// 3. Recommends optimal workflow configuration
// 4. Stores everything in KV + D1 for the workflow engine to use
// ============================================================

import type { Env } from "@nexus/shared";
import { runWithFailover } from "./failover";

// --- Types ---

export interface CEOSetupInput {
  domain_name: string;
  domain_slug: string;
  category_name: string;
  category_slug: string;
  /** Optional user hint about the niche focus */
  niche_hint?: string;
  /** Optional language override */
  language?: string;
}

export interface CEOAnalysis {
  /** Deep niche understanding */
  niche_analysis: {
    market_overview: string;
    target_audience: string;
    buyer_psychology: string;
    price_positioning: string;
    competitive_landscape: string;
    demand_signals: string[];
    key_differentiators: string[];
  };
  /** Generated expert prompts */
  generated_prompts: {
    domain_prompt: string;
    category_prompt: string;
    role_overrides: Record<string, string>;
  };
  /** Workflow recommendations */
  workflow_config: {
    recommended_platforms: string[];
    recommended_social_channels: string[];
    content_tone: string;
    content_style: string;
    pricing_strategy: string;
    seo_focus_keywords: string[];
    quality_threshold: number;
  };
}

export interface CEOSetupResult {
  analysis: CEOAnalysis;
  prompts_stored: number;
  kv_keys_written: string[];
}

// ============================================================
// MASTER CEO PROMPT — The heart of the Auto-Orchestrator
// This prompt makes the AI think like a business strategist
// who deeply understands every niche and knows exactly how
// to configure prompts for maximum quality output.
// ============================================================

function buildCEOAnalysisPrompt(input: CEOSetupInput): string {
  const lang = input.language ?? "en";
  return `You are the AI CEO of NEXUS — a world-class AI business engine that has generated $2M+ in revenue across 50+ niches. You've personally configured AI pipelines for 200+ product categories, and your configurations consistently produce content that ranks in the top 5% of every marketplace.

You are configuring the AI pipeline for a NEW business category. Your configuration will determine the quality of EVERY product created in this category. Get it wrong, and every product fails. Get it right, and every product competes with the top sellers.

=== NEW CATEGORY TO CONFIGURE ===
Domain: ${input.domain_name}
Category: ${input.category_name}
${input.niche_hint ? `User's niche focus hint: ${input.niche_hint}` : ""}
Language: ${lang}

=== THINK STEP-BY-STEP BEFORE CONFIGURING ===

STEP 1 — MARKET UNDERSTANDING: What is the current state of the ${input.domain_name} > ${input.category_name} market? Who are the top sellers? What do they charge? What gaps exist?

STEP 2 — BUYER PSYCHOLOGY: Who buys products in this category? What pain point are they solving? What makes them pull out their wallet? What objections do they have?

STEP 3 — COMPETITIVE POSITIONING: How can a new seller in this niche stand out? What do top sellers do wrong? What angles are underserved?

STEP 4 — PROMPT STRATEGY: What specific instructions will make the AI produce content that competes with the top 5% of sellers in this niche? What tone, style, keywords, and psychological triggers should the prompts encode?

=== YOUR TASK ===
Perform a DEEP analysis of this domain + category combination and generate a complete configuration. Think like you have 15 years of experience selling in this exact niche.

You MUST return a JSON object with EXACTLY this structure:

{
  "niche_analysis": {
    "market_overview": "3-5 sentences about the current state of this market. What's hot, what's dying, where the money flows. Be specific with real market patterns.",
    "target_audience": "Detailed buyer persona. Who buys this? Age range, profession, pain points, desires, browsing habits, purchase triggers. Be specific.",
    "buyer_psychology": "What makes someone pull out their wallet for this type of product? What fears, desires, aspirations drive the purchase? What objections do they have?",
    "price_positioning": "Exact price ranges that work for this niche. Entry-level, mid-tier, premium. What justifies higher prices? What's the sweet spot?",
    "competitive_landscape": "Who are the top sellers? What do they do right? What gaps exist? Where can a new seller win?",
    "demand_signals": ["signal1", "signal2", "...at least 5 specific demand indicators for this niche"],
    "key_differentiators": ["diff1", "diff2", "...at least 5 ways to stand out in this niche"]
  },
  "generated_prompts": {
    "domain_prompt": "A comprehensive domain context prompt (10-15 lines) that captures everything the AI needs to know about the ${input.domain_name} domain. Include: buyer expectations, market rules, pricing norms, content style, platform preferences, SEO patterns, conversion triggers. This prompt will be injected into EVERY workflow step for products in this domain. Write it as instructions to an AI assistant. Make it extremely specific and actionable — NOT generic advice. Include specific keywords, price ranges, psychological triggers, and platform-specific rules.",
    "category_prompt": "A detailed category-specific prompt (10-15 lines) for ${input.category_name}. Include: what makes this category unique within the domain, specific product attributes buyers look for, exact keywords that drive traffic, proven price points, common mistakes to avoid, what the best-selling products in this category have in common, specific SEO tags and keywords. This is injected as Layer D in the prompt system. Be extremely specific — mention exact tools, formats, features that buyers expect.",
    "role_overrides": {
      "researcher": "2-3 sentences customizing the researcher role for this specific niche. What should the researcher focus on? What data matters most? What sources are most relevant?",
      "copywriter": "2-3 sentences customizing the copywriter role. What tone works? What words convert? What style matches the audience? What emotional triggers to use?",
      "seo": "2-3 sentences customizing the SEO specialist. What keyword patterns work? What platform-specific SEO rules matter? What tags convert?",
      "reviewer": "2-3 sentences customizing the quality reviewer. What quality bar should be set? What are common issues in this niche? What does 'ready to publish' look like?"
    }
  },
  "workflow_config": {
    "recommended_platforms": ["platform_slug1", "platform_slug2"],
    "recommended_social_channels": ["channel_slug1", "channel_slug2"],
    "content_tone": "The exact tone of voice for all content in this category (e.g., 'Professional but approachable, data-driven, authority-building')",
    "content_style": "The writing style (e.g., 'Scannable with bullet points, benefit-led headlines, social proof heavy')",
    "pricing_strategy": "Specific pricing recommendation with justification",
    "seo_focus_keywords": ["keyword1", "keyword2", "...at least 10 high-intent keywords for this niche"],
    "quality_threshold": 8
  }
}

=== CRITICAL RULES ===
1. Be EXTREMELY specific. Generic advice is useless. Every sentence should contain actionable intelligence.
2. The domain_prompt and category_prompt are the most important outputs. They will be used by AI models for EVERY product in this category. They must be expert-level.
3. Think about what makes the TOP 1% of sellers in this niche successful. Encode that knowledge into the prompts.
4. The prompts should teach the AI to think like a human expert who has been selling in this niche for years.
5. Include specific numbers: price ranges, character limits, keyword volumes, conversion rates — wherever possible.
6. The role_overrides should genuinely customize each role for this specific niche, not just repeat generic instructions.
7. For recommended_platforms, use slugs from: etsy, gumroad, shopify, redbubble, amazon_kdp
8. For recommended_social_channels, use slugs from: instagram, tiktok, pinterest, linkedin, x_twitter
9. Return ONLY the JSON object. No markdown, no explanation, no code blocks.
10. Every prompt you generate should be written as if a $200/hour consultant wrote it specifically for this niche.

=== EXAMPLE OF EXCELLENT vs POOR DOMAIN PROMPT ===

POOR (too generic): "This domain focuses on digital products. Create high-quality content that appeals to buyers. Use SEO best practices and write compelling descriptions."

EXCELLENT (specific and actionable): "Digital planners sell on emotion + utility. Buyers are 25-40 year old professionals (70% female) who've tried paper planners and failed. They search 'notion planner', 'digital planner adhd', 'weekly planner template'. Price sweet spot: $9.99-$14.99 for singles, $24.99-$34.99 for bundles. Etsy dominates (60% of sales), Gumroad second (25%). Key conversion trigger: showing the planner IN USE with real data, not empty templates. Must include: feature list as buyer benefits, FAQ addressing 'is this hard to set up?', social proof language. Top sellers differentiate by audience (ADHD, students, entrepreneurs) not by features. NEVER use 'comprehensive' or 'ultimate' — buyers are numb to these words."

Your domain_prompt and category_prompt must match the EXCELLENT example's level of specificity.`;
}

// ============================================================
// CEO PROMPT REFINEMENT — Second pass for maximum quality
// Takes the initial analysis and refines the prompts to be
// even more specific and actionable.
// ============================================================

function buildPromptRefinementPrompt(
  input: CEOSetupInput,
  initialAnalysis: CEOAnalysis
): string {
  return `You are the world's top prompt engineer with 10 years of experience optimizing AI prompts for e-commerce. You've refined 500+ prompt templates, and your optimized prompts consistently produce output that scores 9+/10 in quality reviews. Your secret: you encode expert knowledge so deeply that even a mediocre AI model produces expert-level output.

=== NICHE ===
Domain: ${input.domain_name}
Category: ${input.category_name}

=== INITIAL ANALYSIS ===
${JSON.stringify(initialAnalysis.niche_analysis, null, 2)}

=== CURRENT PROMPTS TO REFINE ===
Domain Prompt: ${initialAnalysis.generated_prompts.domain_prompt}

Category Prompt: ${initialAnalysis.generated_prompts.category_prompt}

=== THINK STEP-BY-STEP BEFORE REFINING ===

STEP 1: Read both prompts. What is VAGUE that should be SPECIFIC? ("write good content" → "write 2000+ word descriptions that open with a relatable scenario, not a product announcement")
STEP 2: What buyer psychology is MISSING? (What emotional triggers, objections, and decision factors should be encoded?)
STEP 3: What ANTI-PATTERNS should be explicitly banned? (What mistakes do AI models commonly make in this niche?)
STEP 4: What PLATFORM-SPECIFIC intelligence is missing? (Each platform has different buyer behavior and algorithm rules)

=== YOUR TASK ===
Refine BOTH prompts to be significantly more powerful. Apply these techniques:

1. **Chain-of-Thought Triggers**: Add "Before writing, first analyze..." and "Think step-by-step about..." phrases
2. **Specificity Anchors**: Replace EVERY vague instruction with a concrete, measurable one ("good title" → "title with primary keyword in first 40 chars")
3. **Anti-Pattern Guards**: Add explicit "NEVER" rules for common mistakes in this niche (at least 5 per prompt)
4. **Quality Escalators**: Add phrases that push quality higher ("This must compete with the top 5% of ${input.domain_name} sellers")
5. **Few-Shot Patterns**: Add examples of good vs bad output where helpful
6. **Psychological Triggers**: Encode buyer psychology so AI content naturally triggers purchase desire
7. **SEO Integration**: Weave specific keyword patterns and placement rules into the instructions

Return a JSON object with EXACTLY this structure:
{
  "domain_prompt": "The refined domain prompt (15-20 lines). Must be significantly more detailed and actionable than the original. Include specific anti-patterns, examples, and quality bars.",
  "category_prompt": "The refined category prompt (15-20 lines). Must include specific examples, anti-patterns, keyword patterns, and quality bars.",
  "role_overrides": {
    "researcher": "Refined researcher override (3-4 sentences with specific data sources and analysis focus for this niche)",
    "copywriter": "Refined copywriter override (3-4 sentences with specific tone, emotional triggers, and anti-patterns for this niche)",
    "seo": "Refined SEO override (3-4 sentences with specific keyword patterns, tag strategies, and platform SEO rules for this niche)",
    "reviewer": "Refined reviewer override (3-4 sentences with specific quality bars and common issues to catch in this niche)"
  }
}

Return ONLY the JSON object. No markdown, no explanation.`;
}

// ============================================================
// MAIN CEO SETUP FUNCTION
// Runs the full analysis + prompt generation pipeline
// ============================================================

export async function runCEOSetup(
  input: CEOSetupInput,
  env: Env
): Promise<CEOSetupResult> {
  // ── Step 1: Deep niche analysis + initial prompt generation ──
  const analysisPrompt = buildCEOAnalysisPrompt(input);

  const analysisResult = await runWithFailover("reasoning", analysisPrompt, env);
  let analysis: CEOAnalysis;

  try {
    analysis = parseAnalysisResponse(analysisResult.result);
  } catch (parseErr) {
    throw new Error(
      `CEO analysis failed to parse: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
    );
  }

  // ── Step 2: Refine prompts for maximum quality ──
  const refinementPrompt = buildPromptRefinementPrompt(input, analysis);

  try {
    const refinementResult = await runWithFailover("reasoning", refinementPrompt, env);
    const refined = parseRefinedPrompts(refinementResult.result);

    // Replace initial prompts with refined versions
    analysis.generated_prompts.domain_prompt = refined.domain_prompt;
    analysis.generated_prompts.category_prompt = refined.category_prompt;
    analysis.generated_prompts.role_overrides = refined.role_overrides;
  } catch (refineErr) {
    // If refinement fails, keep the initial prompts — they're still good
    console.warn(
      `[CEO] Prompt refinement failed, using initial prompts: ${
        refineErr instanceof Error ? refineErr.message : String(refineErr)
      }`
    );
  }

  // ── Step 3: Store prompts in KV ──
  const kvKeysWritten: string[] = [];

  // Store domain prompt
  const domainKey = `prompt:domain:${input.domain_slug}`;
  await env.KV.put(domainKey, analysis.generated_prompts.domain_prompt);
  kvKeysWritten.push(domainKey);

  // Store category prompt
  const categoryKey = `prompt:category:${input.category_slug}`;
  await env.KV.put(categoryKey, analysis.generated_prompts.category_prompt);
  kvKeysWritten.push(categoryKey);

  // Store role overrides
  for (const [role, prompt] of Object.entries(
    analysis.generated_prompts.role_overrides
  )) {
    const roleKey = `prompt:role:${role}:${input.category_slug}`;
    await env.KV.put(roleKey, prompt);
    kvKeysWritten.push(roleKey);
  }

  // Store full CEO config
  const configKey = `ceo:config:${input.category_slug}`;
  await env.KV.put(configKey, JSON.stringify(analysis), {
    metadata: {
      domain: input.domain_name,
      category: input.category_name,
      generated_at: new Date().toISOString(),
    },
  });
  kvKeysWritten.push(configKey);

  // Store workflow recommendations
  const workflowKey = `ceo:workflow:${input.category_slug}`;
  await env.KV.put(workflowKey, JSON.stringify(analysis.workflow_config));
  kvKeysWritten.push(workflowKey);

  console.log(
    `[CEO] Setup complete for ${input.domain_name} > ${input.category_name}. ` +
      `${kvKeysWritten.length} KV keys written.`
  );

  return {
    analysis,
    prompts_stored: kvKeysWritten.length - 2, // Subtract config and workflow keys
    kv_keys_written: kvKeysWritten,
  };
}

// ============================================================
// GET EXISTING CEO CONFIG
// ============================================================

export async function getCEOConfig(
  categorySlug: string,
  env: Env
): Promise<CEOAnalysis | null> {
  const configKey = `ceo:config:${categorySlug}`;
  const config = await env.KV.get<CEOAnalysis>(configKey, "json");
  return config;
}

// ============================================================
// RESPONSE PARSING HELPERS
// ============================================================

function parseAnalysisResponse(raw: string): CEOAnalysis {
  // Try direct parse
  try {
    const parsed = JSON.parse(raw) as CEOAnalysis;
    validateAnalysis(parsed);
    return parsed;
  } catch {
    // continue
  }

  // Extract from markdown code blocks
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim()) as CEOAnalysis;
      validateAnalysis(parsed);
      return parsed;
    } catch {
      // continue
    }
  }

  // Find balanced JSON
  const startIdx = raw.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = startIdx; i < raw.length; i++) {
      const ch = raw[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(raw.slice(startIdx, i + 1)) as CEOAnalysis;
            validateAnalysis(parsed);
            return parsed;
          } catch {
            break;
          }
        }
      }
    }
  }

  const preview = raw.length > 300 ? raw.slice(0, 300) + "..." : raw;
  throw new Error(`Failed to parse CEO analysis response: ${preview}`);
}

function validateAnalysis(obj: CEOAnalysis): void {
  if (!obj.niche_analysis) throw new Error("Missing niche_analysis");
  if (!obj.generated_prompts) throw new Error("Missing generated_prompts");
  if (!obj.workflow_config) throw new Error("Missing workflow_config");
  if (!obj.generated_prompts.domain_prompt)
    throw new Error("Missing domain_prompt");
  if (!obj.generated_prompts.category_prompt)
    throw new Error("Missing category_prompt");
}

interface RefinedPrompts {
  domain_prompt: string;
  category_prompt: string;
  role_overrides: Record<string, string>;
}

function parseRefinedPrompts(raw: string): RefinedPrompts {
  // Try direct parse
  try {
    const parsed = JSON.parse(raw) as RefinedPrompts;
    if (parsed.domain_prompt && parsed.category_prompt) return parsed;
  } catch {
    // continue
  }

  // Extract from markdown code blocks
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim()) as RefinedPrompts;
      if (parsed.domain_prompt && parsed.category_prompt) return parsed;
    } catch {
      // continue
    }
  }

  // Find balanced JSON
  const startIdx = raw.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = startIdx; i < raw.length; i++) {
      const ch = raw[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(raw.slice(startIdx, i + 1)) as RefinedPrompts;
            if (parsed.domain_prompt && parsed.category_prompt) return parsed;
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("Failed to parse refined prompts response");
}
