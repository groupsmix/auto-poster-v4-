// ============================================================
// Workflow Step Definitions — 9-step pipeline configuration
// Each step: task_type, role, prompt layers, output schema
// Domain-aware: POD vs Digital vs Content etc. may differ
// ============================================================

import type { TaskType, CEOWorkflowConfig } from "@nexus/shared";
import { WORKFLOW_STEPS } from "@nexus/shared";

// --- Step name type derived from shared constants ---

export type StepName = (typeof WORKFLOW_STEPS)[number];

// --- Step configuration ---

export interface StepConfig {
  /** Display name for the UI */
  label: string;
  /** Which AI task type to use for this step */
  taskType: TaskType;
  /** Role prompt key (Layer B) */
  role: string;
  /** Whether this step uses platform-specific prompts (Layer E) */
  usesPlatformPrompt: boolean;
  /** Whether this step calls nexus-variation instead of nexus-ai */
  usesVariationWorker: boolean;
  /** Task prompt template (Layer F) — the core instruction for this step */
  taskPrompt: string;
  /** Keys from prior step outputs to inject as context (Layer I) */
  contextKeys: StepName[];
  /** Whether this step can be independently re-run on revision */
  revisable: boolean;
}

// --- Output schemas per step (Layer H) ---

export interface ResearchOutput {
  market_trends: string[];
  competitor_analysis: string[];
  target_audience: string;
  price_range: { min: number; max: number; recommended: number };
  top_keywords: string[];
  niche_opportunities: string[];
  demand_signals: string[];
}

export interface StrategyOutput {
  positioning: string;
  unique_angle: string;
  target_persona: string;
  value_proposition: string;
  competitive_advantages: string[];
  pricing_strategy: { price: number; justification: string };
  content_direction: string;
  seo_strategy: string;
}

export interface ContentGenerationOutput {
  product_name: string;
  tagline: string;
  description: string;
  features: string[];
  benefits: string[];
  faq: Array<{ question: string; answer: string }>;
  use_cases: string[];
}

export interface SEOOptimizationOutput {
  seo_title: string;
  meta_description: string;
  primary_keywords: string[];
  secondary_keywords: string[];
  tags: string[];
  url_slug: string;
  keyword_density_notes: string;
}

export interface ImageGenerationOutput {
  image_prompts: Array<{
    description: string;
    style: string;
    dimensions: string;
    purpose: string;
  }>;
  mockup_instructions: string;
  thumbnail_concept: string;
}

export interface PlatformVariantsOutput {
  variants: Array<{
    platform: string;
    title: string;
    description: string;
    tags: string[];
    price: number;
    cta: string;
    notes: string;
  }>;
}

export interface SocialContentOutput {
  posts: Array<{
    channel: string;
    content: string;
    hashtags: string[];
    hook: string;
    cta: string;
    format: string;
  }>;
}

export interface HumanizerOutput {
  humanized_description: string;
  humanized_variants: Array<{
    platform: string;
    title: string;
    description: string;
  }>;
  humanized_social: Array<{
    channel: string;
    content: string;
  }>;
  changes_made: string[];
}

export interface QualityReviewOutput {
  overall_score: number;
  approved: boolean;
  scores: Record<string, number>;
  issues: Array<{
    criterion: string;
    problem: string;
    fix: string;
  }>;
  revised_sections: Record<string, unknown>;
  summary: string;
}

// --- Union type for all step outputs ---

export type StepOutput =
  | ResearchOutput
  | StrategyOutput
  | ContentGenerationOutput
  | SEOOptimizationOutput
  | ImageGenerationOutput
  | PlatformVariantsOutput
  | SocialContentOutput
  | HumanizerOutput
  | QualityReviewOutput;

// --- Output schema JSON templates (Layer H) ---

const OUTPUT_SCHEMAS: Record<StepName, Record<string, unknown>> = {
  research: {
    market_trends: ["string"],
    competitor_analysis: ["string"],
    target_audience: "string",
    price_range: { min: "number", max: "number", recommended: "number" },
    top_keywords: ["string"],
    niche_opportunities: ["string"],
    demand_signals: ["string"],
  },
  strategy: {
    positioning: "string",
    unique_angle: "string",
    target_persona: "string",
    value_proposition: "string",
    competitive_advantages: ["string"],
    pricing_strategy: { price: "number", justification: "string" },
    content_direction: "string",
    seo_strategy: "string",
  },
  content_generation: {
    product_name: "string",
    tagline: "string",
    description: "string (2000-5000 words, detailed, human-quality)",
    features: ["string"],
    benefits: ["string"],
    faq: [{ question: "string", answer: "string" }],
    use_cases: ["string"],
  },
  seo_optimization: {
    seo_title: "string",
    meta_description: "string (max 160 chars)",
    primary_keywords: ["string"],
    secondary_keywords: ["string"],
    tags: ["string"],
    url_slug: "string",
    keyword_density_notes: "string",
  },
  image_generation: {
    image_prompts: [
      {
        description: "string",
        style: "string",
        dimensions: "string",
        purpose: "string",
      },
    ],
    mockup_instructions: "string",
    thumbnail_concept: "string",
  },
  platform_variants: {
    variants: [
      {
        platform: "string",
        title: "string",
        description: "string",
        tags: ["string"],
        price: "number",
        cta: "string",
        notes: "string",
      },
    ],
  },
  social_content: {
    posts: [
      {
        channel: "string",
        content: "string",
        hashtags: ["string"],
        hook: "string",
        cta: "string",
        format: "string",
      },
    ],
  },
  humanizer_pass: {
    humanized_description: "string",
    humanized_variants: [
      {
        platform: "string",
        title: "string",
        description: "string",
      },
    ],
    humanized_social: [
      {
        channel: "string",
        content: "string",
      },
    ],
    changes_made: ["string"],
  },
  quality_review: {
    overall_score: "number (1-10)",
    approved: "boolean (true only if ALL scores >= 8)",
    scores: {
      title_strength: "number",
      description_quality: "number",
      seo_quality: "number",
      price_logic: "number",
      platform_fit: "number",
      human_quality: "number",
      overall_readiness: "number",
    },
    issues: [{ criterion: "string", problem: "string", fix: "string" }],
    revised_sections: "object (only sections that need revision)",
    summary: "string",
  },
};

// --- Step configurations for the 9-step pipeline ---

const STEP_CONFIGS: Record<StepName, StepConfig> = {
  research: {
    label: "Research",
    taskType: "research",
    role: "researcher",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Conduct deep market research for this product concept. You are analyzing this niche as if you're about to invest $10,000 of your own money into it.

=== THINK STEP-BY-STEP BEFORE RESEARCHING ===

STEP 1: Who is the buyer? What problem are they trying to solve? What do they type into the search bar?
STEP 2: Who are the top 5 sellers in this niche? What are they doing right? What gaps are they leaving?
STEP 3: What price point maximizes revenue (not just sales volume)?
STEP 4: What keywords have HIGH buyer intent vs just browsing intent?

=== NOW RESEARCH AND DELIVER ===

1. Market trends — specific demand signals ("search volume up 40% YoY" not "growing market")
2. Competitor analysis — what top sellers charge, their strengths AND weaknesses, gaps you can exploit
3. Target audience — demographics, psychographics, pain points, buying triggers, objections
4. Price range — min/max/recommended with justification from competitor data
5. Keywords — buyer-intent keywords only ("buy notion planner" not "what is notion")
6. Niche opportunities — untapped angles competitors are missing
7. Demand signals — specific evidence this niche has paying customers

=== QUALITY RULES ===
- Every trend must be specific and verifiable, not vague
- Every keyword must have buyer intent — informational keywords are worthless
- Every competitor insight must be actionable ("their descriptions lack FAQ" not "competition exists")
- If your insight could apply to ANY niche, it's too vague. Make it specific to THIS niche.`,
    contextKeys: [],
    revisable: true,
  },

  strategy: {
    label: "Strategy",
    taskType: "research",
    role: "researcher",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Build a razor-sharp product strategy based on the research findings. Every decision must be backed by specific data from the research phase.

=== THINK STEP-BY-STEP BEFORE STRATEGIZING ===

STEP 1: Review the research data. What is the single biggest opportunity identified?
STEP 2: Who is the IDEAL buyer? Not "everyone" — the ONE person most likely to buy.
STEP 3: What positioning makes this product impossible to compare with competitors? (If buyers can easily compare, they'll choose the cheapest.)
STEP 4: What price maximizes revenue? (Not the cheapest, not the most expensive — the sweet spot.)

=== NOW BUILD THE STRATEGY ===

1. Positioning — how this product stands out in a crowded market. Be specific: "The only [X] designed specifically for [Y audience] who struggle with [Z problem]"
2. Unique angle — what makes this IMPOSSIBLE to ignore vs competitors. Reference specific competitor weaknesses from research.
3. Target persona — detailed buyer profile with name, age, job, pain points, buying triggers, objections, and where they hang out online
4. Value proposition — one sentence that makes the buyer think "I NEED this." Format: "[Product] helps [audience] [achieve outcome] without [pain point]"
5. Competitive advantages — 3-5 specific reasons to buy THIS over alternatives, each referencing competitor gaps
6. Pricing strategy — exact price with justification from competitor data and perceived value analysis
7. Content direction — tone, style, emotional triggers, and narrative approach for all copy
8. SEO strategy — primary keyword target, secondary keywords, and platform-specific keyword approach

=== QUALITY RULES ===
- Every decision MUST reference specific data from the research phase
- No generic positioning ("high-quality product" is banned — say what makes it high-quality)
- The value proposition must pass the "So what?" test — if a buyer can say "so what?", it's too vague
- Pricing must include psychological pricing rationale ($12.99 not $13, $27 not $30)`,
    contextKeys: ["research"],
    revisable: true,
  },

  content_generation: {
    label: "Content Generation",
    taskType: "writing",
    role: "copywriter",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Create the complete product content package. This is the core sales copy that will determine whether buyers click "Add to Cart" or scroll past.

=== THINK STEP-BY-STEP BEFORE WRITING ===

STEP 1: Review the strategy. Who is the target persona? What's their biggest pain point?
STEP 2: What are the 3 strongest emotional triggers for this audience? (Fear of missing out? Desire for transformation? Frustration with current solutions?)
STEP 3: Plan the narrative arc: Hook → Pain → Solution → Proof → CTA
STEP 4: What objections will the buyer have? Plan to address each one.

=== NOW CREATE THE CONTENT ===

1. Product name — memorable, SEO-friendly, niche-specific. Front-load the primary keyword.
2. Tagline — one sentence that sells the TRANSFORMATION, not the product. "From [pain] to [outcome]" format.
3. Full description (2000-5000 words) — human-quality, conversion-optimized:
   - Open with a vivid scenario the buyer relates to (NOT "Introducing..." or "Welcome to...")
   - Address the pain point in the buyer's own language
   - Present the product as the solution with specific proof
   - Include scannable formatting: headers, bullets, short paragraphs
   - End with a clear, urgent CTA
4. Features — each feature MUST be paired with its buyer benefit ("Weekly review template" → "Never lose track of your goals again")
5. Benefits — outcome-focused, emotional, specific ("Save 5 hours/week" not "Save time")
6. FAQ (5+ questions) — address REAL buyer objections: "Is this worth the price?", "Will this work for me?", "How hard is setup?"
7. Use cases — 3-5 specific scenarios showing the product solving real problems for real people

=== ANTI-PATTERNS (NEVER DO) ===
- Never start with "Introducing..." or "Welcome to our..."
- Never use "comprehensive", "ultimate", "game-changer", "elevate", "unlock", "seamless"
- Never list features without translating each into a buyer benefit
- Never write FAQ answers longer than 2-3 sentences
- Never write all sentences the same length — vary your rhythm naturally

=== EXAMPLE OF GOOD DESCRIPTION OPENING ===
BAD: "This comprehensive Notion template will help you organize your life and boost your productivity!"
GOOD: "Monday morning. You open one dashboard and everything's there — priorities ranked, deadlines mapped, habits tracked. No more scattered notes. No more forgotten tasks. Just clarity."`,
    contextKeys: ["research", "strategy"],
    revisable: true,
  },

  seo_optimization: {
    label: "SEO Optimization",
    taskType: "seo",
    role: "seo",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Optimize all content for maximum organic discoverability across target platforms. Your SEO must be invisible — it reads like great copy that happens to be perfectly optimized.

=== THINK STEP-BY-STEP BEFORE OPTIMIZING ===

STEP 1: What does the BUYER type into the search bar? (Not what describes the product — what the buyer actually searches)
STEP 2: Which keywords from the research have the highest PURCHASE intent?
STEP 3: Where does each platform weight keywords most heavily? (Title? Tags? Description? Backend fields?)
STEP 4: What long-tail variations capture niche buyers that competitors miss?

=== NOW OPTIMIZE ===

1. SEO title — primary keyword in the FIRST 40 characters. Remaining characters for secondary keywords and benefit hooks. Must be attention-grabbing AND algorithm-friendly.
2. Meta description — max 160 chars. Must include primary keyword AND a compelling CTA. This is your mini-ad in search results.
3. Primary keywords (3-5) — high buyer-intent keywords that signal purchase readiness
4. Secondary keywords (5-10) — long-tail variations that capture niche searches
5. Tags — platform-optimized set. Etsy: exactly 13 tags. Redbubble: exactly 15. Each tag is a separate search opportunity.
6. URL slug — short, lowercase, hyphenated, includes primary keyword
7. Keyword density notes — specific placement instructions for natural keyword integration

=== SEO RULES (NEVER BREAK) ===
- Primary keyword MUST be in the first 40 characters of the title
- Tags must NOT repeat exact words already in the title (platforms already index the title)
- Tags must mix broad terms (1-2 words) with specific long-tail phrases (3-5 words)
- Never sacrifice readability for keyword density
- Every keyword must have buyer intent — informational keywords are worthless for product listings
- Meta descriptions must include both the primary keyword AND a CTA

=== EXAMPLE ===
BAD title: "Beautiful Digital Planner Template for Organization and Productivity 2024"
GOOD title: "ADHD Planner Notion Template | Daily Focus Dashboard + Weekly Review System"
WHY: Primary keyword front-loaded, pipe separator, specific features as secondary keywords.`,
    contextKeys: ["research", "strategy", "content_generation"],
    revisable: true,
  },

  image_generation: {
    label: "Image Generation",
    taskType: "image",
    role: "copywriter",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Create detailed image generation prompts that will make buyers STOP scrolling and CLICK. Remember: the thumbnail is seen at 150x150px on mobile — if it doesn't pop at that size, it fails.

=== THINK STEP-BY-STEP BEFORE DESIGNING ===

STEP 1: What will the thumbnail look like at 150x150px on a phone? Can you read any text? Does it stand out in a grid of competitors?
STEP 2: What emotion should the buyer feel when they see the hero image? (Excitement? Relief? Aspiration?)
STEP 3: What visual proof shows this product is high-quality? (Clean UI screenshots for digital, lifestyle shots for physical)
STEP 4: What mockup context makes the buyer imagine themselves USING this product?

=== NOW CREATE IMAGE PROMPTS ===

1. Hero/cover image — the main product visual. Must show the product IN CONTEXT, not isolated on white. Lifestyle mockups convert 3x better than flat-lay.
2. Feature showcase images (2-3) — each highlighting a specific feature with a benefit callout
3. Lifestyle/context images (1-2) — showing the product being used by the target persona in their real environment
4. Mockup instructions — specific guidance for presenting the product on each target platform
5. Thumbnail concept — designed for 150x150px visibility. High contrast, readable text, clear subject.

=== IMAGE PROMPT RULES ===
- Every prompt must specify: subject, style, mood/lighting, color palette, composition, and dimensions
- Use color psychology: blue for trust (finance), green for growth (planners), warm tones for creativity
- Hero images must show the product in context, not isolated on white
- Include at least one "feature zoom" showing a specific detail
- Thumbnail must work at 150x150px — if you can't read it small, redesign it
- Never use generic stock photo language ("happy person at desk") — be specific about the scene, emotion, and setting
- Platform-specific dimensions: Etsy 2000x2000 square, Gumroad wide hero banner, Pinterest 1000x1500 vertical`,
    contextKeys: ["research", "strategy", "content_generation"],
    revisable: true,
  },

  platform_variants: {
    label: "Platform Variants",
    taskType: "variation",
    role: "copywriter",
    usesPlatformPrompt: true,
    usesVariationWorker: true,
    taskPrompt: `Rewrite the product listing for each target platform. Each platform has COMPLETELY different buyers, algorithms, and conversion psychology. A listing that works on Etsy will FAIL on Gumroad.

=== THINK STEP-BY-STEP FOR EACH PLATFORM ===

STEP 1: Who is the buyer on THIS platform? What are they looking for? How do they browse?
STEP 2: What does this platform's algorithm reward? (Tags? Keywords? Click-through rate? Sales velocity?)
STEP 3: What tone and style converts on THIS platform? (Etsy = warm/personal, Gumroad = creator-to-creator, Shopify = brand-driven)
STEP 4: What are the HARD constraints? (Character limits, tag counts, forbidden words)

=== FOR EACH PLATFORM, DELIVER ===

1. Title — adapted to platform's character limit, tone, and SEO rules. Primary keyword front-loaded.
2. Description — COMPLETELY rewritten for platform's audience. Not adapted — rewritten from scratch.
3. Tags — platform-specific, using ALL available tag slots. Each tag is a search opportunity.
4. Price — adjusted for platform's buyer psychology and competitive landscape
5. CTA — platform-appropriate call to action
6. Notes — platform-specific optimization tips

=== CRITICAL RULES ===
- Do NOT copy-paste between platforms. Each variant must feel native to its platform.
- Etsy buyers want warmth and story. Gumroad buyers want value and outcomes. Shopify buyers want brand trust.
- Use ALL available tag slots on every platform (Etsy=13, Redbubble=15, etc.)
- Respect every character limit as a HARD constraint — never exceed.
- Each variant should feel like it was written by a top seller ON THAT SPECIFIC PLATFORM.`,
    contextKeys: ["content_generation", "seo_optimization"],
    revisable: true,
  },

  social_content: {
    label: "Social Content",
    taskType: "social",
    role: "copywriter",
    usesPlatformPrompt: false,
    usesVariationWorker: true,
    taskPrompt: `Create social media content for each selected channel. The hook is EVERYTHING — if the first line doesn't stop the scroll, nothing else matters.

=== THINK STEP-BY-STEP FOR EACH CHANNEL ===

STEP 1: What makes someone STOP scrolling on THIS channel? (TikTok = pattern interrupt, Instagram = visual + curiosity, LinkedIn = bold professional claim, Pinterest = searchable inspiration, X = witty one-liner)
STEP 2: What format gets the most SAVES/BOOKMARKS on this channel? (Saves = algorithmic gold everywhere)
STEP 3: What CTA actually drives conversions on this channel? ("Link in bio" vs "Link in comments" vs direct link)
STEP 4: What are the HARD constraints? (Character limits, hashtag counts, format rules)

=== FOR EACH CHANNEL, DELIVER ===

1. Content — matching the channel's native format and tone exactly
2. Hook — the first line/sentence that stops the scroll. This is 80% of the post's success.
3. Hashtags — within channel limits, mixing broad and niche
4. CTA — channel-appropriate, conversion-focused
5. Format — exact content structure for the channel

=== CHANNEL-SPECIFIC RULES ===
- TikTok: Hook in first 1-3 seconds. Raw > polished. End with a question. 3-5 hashtags max.
- Instagram: First line before "...more" must hook. Carousel > single image. 15-20 hashtags.
- LinkedIn: First 2 lines before "see more" must hook. NO external links in post body. Professional but human.
- Pinterest: SEO-first — it's a search engine, not a social network. Keywords > creativity.
- X/Twitter: Hook tweet must work standalone. No hashtags in body. Bookmark-worthy = algorithmic boost.

=== ANTI-PATTERNS ===
- Never start with "Check out our new product!" or "We're excited to announce..."
- Never use the same hook across channels — each platform needs a native hook
- Never exceed character/hashtag limits — these are HARD constraints`,
    contextKeys: ["content_generation", "seo_optimization", "platform_variants"],
    revisable: true,
  },

  humanizer_pass: {
    label: "Humanizer Pass",
    taskType: "humanizer",
    role: "copywriter",
    usesPlatformPrompt: false,
    usesVariationWorker: true,
    taskPrompt: `You are a human editor with 10 years of experience. Your job: take AI-generated text and make it IMPOSSIBLE to detect as AI-written. The goal is zero AI-detection score.

=== THINK STEP-BY-STEP BEFORE EDITING ===

STEP 1: Read through ALL the content. Flag every sentence that "sounds like AI" — you'll know it when you see it.
STEP 2: Check for these INSTANT-FAIL AI patterns:
- "In today's..." / "In the world of..." / "In this digital age..."
- "Whether you're a... or a..."
- "This comprehensive..." / "This innovative..."
- "Unlock the power of..." / "Elevate your..." / "Take it to the next level"
- "Seamless" / "Robust" / "Cutting-edge" / "Game-changer" / "Delve"
- "It's worth noting that..." / "It's important to remember..."
- "Moreover" / "Furthermore" / "In conclusion" / "Additionally"
- Sentences that ALL start the same way or are ALL the same length
- Excessive exclamation marks (more than 2 per listing)
STEP 3: Plan natural replacements that sound like a real expert wrote them.

=== NOW HUMANIZE EVERYTHING ===

1. Main product description — rewrite robotic phrases, add natural conversational flow
2. All platform variants — each must sound like a real top seller on THAT platform wrote it
3. All social content — must sound like a real person posting, not a brand account

=== HUMANIZATION RULES ===
- Vary sentence length naturally: short punchy sentences mixed with longer flowing ones
- Use contractions (don't, won't, it's, they're) — humans always use contractions
- Start some sentences with "And" or "But" — it's natural
- Use dashes for asides — like this — instead of always using commas
- Replace "Moreover" → "Plus" or "Oh, and" or just start the next thought
- Replace "Furthermore" → "Here's the thing" or drop it entirely
- Replace "In conclusion" → just make the final point naturally
- Add occasional sentence fragments. "Worth it." "Not even close." "Game over."
- Keep the SAME meaning, facts, and approximate length
- Track every change made so the team can learn from patterns

The result must read like a knowledgeable human expert wrote it from scratch — not like AI text that was "cleaned up."`,
    contextKeys: ["content_generation", "platform_variants", "social_content"],
    revisable: true,
  },

  quality_review: {
    label: "Quality Review",
    taskType: "review",
    role: "reviewer",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `You are the CEO doing the final quality review before this product goes live. Your approval rate is 35% — you only let through work that competes with the top 10% of sellers on any platform.

Your standard: Would a top seller with $500K+ revenue publish this EXACTLY as-is, with zero edits?

=== REVIEW PROCESS (FOLLOW THIS EXACT SEQUENCE) ===

STEP 1 — FIRST IMPRESSION: Read the title and first sentence of the description. Would you click? Would you keep reading? If not, it already fails.

STEP 2 — DEEP REVIEW: Score each criterion 1-10:
1. TITLE STRENGTH — Does it stop scrolling? Front-load primary keyword? Within platform character limit? Stand out in a grid of 20 competitors?
2. DESCRIPTION QUALITY — Does the first sentence hook? Does it address pain points? Clear CTA? Would a real buyer read past the fold?
3. SEO QUALITY — Primary keyword in title + description + tags? All tag slots used? Buyer-intent keywords only?
4. PRICE LOGIC — Competitive but not cheapest? Psychological pricing used? Description justifies the price?
5. PLATFORM FIT — Tone matches platform audience? All format rules followed? Platform-specific trust signals included?
6. HUMAN QUALITY — Scan for AI patterns: "elevate", "unlock", "comprehensive", "In today's...", "Whether you're...". Varied sentence lengths? Natural contractions? Would it pass an AI detector?
7. OVERALL READINESS — Would you publish this under your own brand right now? Would you be proud if a competitor saw it?

STEP 3 — SCORING CALIBRATION:
- Score 10: Top 1%. Editor's Picks quality. Flawless.
- Score 9: Top 5%. Publish immediately. Minor improvements possible.
- Score 8: Top 15%. Passes the bar. One or two small fixes would elevate it.
- Score 7: Average. Publishable but won't stand out. Needs improvement.
- Score 6 or below: Below standard. Major revision required.

STEP 4 — FIXES: For any score below 8, provide:
- EXACTLY what is wrong (specific, not vague)
- EXACTLY what should change (with the corrected version ready to use)

Set approved=true ONLY if ALL individual scores are >= 8. One score of 7 means the whole package needs revision.`,
    contextKeys: [
      "research",
      "strategy",
      "content_generation",
      "seo_optimization",
      "image_generation",
      "platform_variants",
      "social_content",
      "humanizer_pass",
    ],
    revisable: false,
  },
};

// --- Public API ---

/**
 * Get the step configuration for a given step name.
 */
export function getStepConfig(stepName: StepName): StepConfig {
  return STEP_CONFIGS[stepName];
}

/**
 * Get the expected output JSON schema for a given step.
 */
export function getOutputSchema(stepName: StepName): Record<string, unknown> {
  return OUTPUT_SCHEMAS[stepName];
}

/**
 * Get all step configurations in execution order.
 */
export function getAllStepConfigs(): Array<{ name: StepName; config: StepConfig }> {
  return WORKFLOW_STEPS.map((name) => ({
    name,
    config: STEP_CONFIGS[name],
  }));
}

// --- Prompt building (Layers A through I) ---

export interface PromptTemplates {
  master?: string;
  roles?: Record<string, string>;
  domains?: Record<string, string>;
  categories?: Record<string, string>;
  platforms?: Record<string, string>;
}

export interface ProductContext {
  domain_id: string;
  domain_slug: string;
  category_id: string;
  category_slug: string;
  niche?: string;
  name?: string;
  description?: string;
  keywords?: string;
  language: string;
  platforms: string[];
  social_channels: string[];
  user_input?: Record<string, unknown>;
}

/**
 * Build the full layered prompt for a workflow step.
 *
 * Layer A: Master system prompt
 * Layer B: Role prompt (researcher, copywriter, seo, reviewer)
 * Layer C: Domain prompt (digital-products, pod, etc.)
 * Layer D: Category prompt (notion-templates, t-shirts, etc.)
 * Layer E: Platform prompt (only if step uses platform prompts)
 * Layer F: Task prompt (step-specific instructions)
 * Layer G: User input injection (optional fields from setup form)
 * Layer H: Output schema (expected JSON structure)
 * Layer I: Context injection (prior step outputs)
 */
/**
 * Maximum estimated token count for a prompt before context truncation kicks in.
 * Rough estimation: 1 token ≈ 4 characters.
 * 24K tokens (≈96K chars) leaves headroom for model response within 32K context windows.
 */
export const PROMPT_MAX_ESTIMATED_TOKENS = 24_000;
export const CHARS_PER_TOKEN_ESTIMATE = 4;

/** Estimate token count from text length (rough: text.length / 4) */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

export function buildPromptForStep(
  stepName: StepName,
  product: ProductContext,
  priorOutputs: Partial<Record<StepName, Record<string, unknown>>>,
  promptTemplates: PromptTemplates,
  revisionFeedback?: string,
  ceoConfig?: CEOWorkflowConfig
): string {
  const config = getStepConfig(stepName);
  const schema = getOutputSchema(stepName);
  const layers: string[] = [];

  // Layer A: Master system prompt
  if (promptTemplates.master) {
    layers.push(`=== SYSTEM INSTRUCTIONS ===\n${promptTemplates.master}`);
  }

  // Layer B: Role prompt
  const rolePrompt = promptTemplates.roles?.[config.role];
  if (rolePrompt) {
    layers.push(`=== YOUR ROLE ===\n${rolePrompt}`);
  }

  // Layer C: Domain prompt
  const domainPrompt = promptTemplates.domains?.[product.domain_slug];
  if (domainPrompt) {
    layers.push(`=== DOMAIN CONTEXT ===\n${domainPrompt}`);
  }

  // Layer D: Category prompt
  const categoryPrompt = promptTemplates.categories?.[product.category_slug];
  if (categoryPrompt) {
    layers.push(`=== CATEGORY CONTEXT ===\n${categoryPrompt}`);
  }

  // Layer D.5: CEO niche directives (injected from AI CEO workflow config)
  if (ceoConfig) {
    const ceoParts: string[] = [];
    if (ceoConfig.content_tone) {
      ceoParts.push(`Content Tone: ${ceoConfig.content_tone}`);
    }
    if (ceoConfig.content_style) {
      ceoParts.push(`Content Style: ${ceoConfig.content_style}`);
    }
    if (ceoConfig.pricing_strategy) {
      ceoParts.push(`Pricing Strategy: ${ceoConfig.pricing_strategy}`);
    }
    if (ceoConfig.seo_focus_keywords && ceoConfig.seo_focus_keywords.length > 0) {
      ceoParts.push(`SEO Focus Keywords: ${ceoConfig.seo_focus_keywords.join(", ")}`);
    }
    if (ceoParts.length > 0) {
      layers.push(`=== CEO NICHE DIRECTIVES ===\nThe AI CEO has analyzed this niche and recommends the following directives. Follow them closely:\n${ceoParts.join("\n")}`);
    }
  }

  // Layer E: Platform prompt (if applicable)
  if (config.usesPlatformPrompt && product.platforms.length > 0) {
    const platformPrompts: string[] = [];
    for (const platformSlug of product.platforms) {
      const pp = promptTemplates.platforms?.[platformSlug];
      if (pp) {
        platformPrompts.push(`--- ${platformSlug} ---\n${pp}`);
      }
    }
    if (platformPrompts.length > 0) {
      layers.push(`=== PLATFORM RULES ===\n${platformPrompts.join("\n\n")}`);
    }
  }

  // Layer F: Task prompt
  layers.push(`=== TASK ===\n${config.taskPrompt}`);

  // Layer G: User input injection
  const userInputParts: string[] = [];
  if (product.language) userInputParts.push(`Language: ${product.language}`);
  if (product.niche) userInputParts.push(`Niche: ${product.niche}`);
  if (product.name) userInputParts.push(`Product Name: ${product.name}`);
  if (product.description) userInputParts.push(`Description: ${product.description}`);
  if (product.keywords) userInputParts.push(`Keywords: ${product.keywords}`);
  if (product.platforms.length > 0) {
    userInputParts.push(`Target Platforms: ${product.platforms.join(", ")}`);
  }
  if (product.social_channels.length > 0) {
    userInputParts.push(`Social Channels: ${product.social_channels.join(", ")}`);
  }
  if (product.user_input) {
    for (const [key, value] of Object.entries(product.user_input)) {
      if (value !== undefined && value !== null && value !== "") {
        userInputParts.push(`${key}: ${String(value)}`);
      }
    }
  }
  if (userInputParts.length > 0) {
    layers.push(`=== USER INPUT ===\n${userInputParts.join("\n")}`);
  }

  // Layer H: Output schema
  layers.push(
    `=== OUTPUT FORMAT ===\nRespond with ONLY valid JSON matching this exact schema:\n${JSON.stringify(schema, null, 2)}`
  );

  // Layer I: Context injection (prior step outputs)
  const contextParts: string[] = [];
  for (const contextKey of config.contextKeys) {
    const output = priorOutputs[contextKey];
    if (output) {
      const stepLabel = STEP_CONFIGS[contextKey].label;
      contextParts.push(
        `--- ${stepLabel} Results ---\n${JSON.stringify(output, null, 2)}`
      );
    }
  }

  // Include revision feedback in context if provided
  if (revisionFeedback) {
    contextParts.push(
      `--- CEO Revision Feedback ---\n${revisionFeedback}\n\nAddress ALL feedback points specifically. Do not ignore any feedback.`
    );
  }

  if (contextParts.length > 0) {
    layers.push(
      `=== CONTEXT FROM PRIOR STEPS ===\n${contextParts.join("\n\n")}`
    );
  }

  // --- Prompt size guard: truncate context if estimated tokens exceed threshold ---
  let assembled = layers.join("\n\n");
  const estimatedTokens = estimateTokenCount(assembled);

  if (estimatedTokens > PROMPT_MAX_ESTIMATED_TOKENS) {
    console.warn(
      `[PROMPT] Step "${stepName}" prompt exceeds token limit: ~${estimatedTokens} estimated tokens (max ${PROMPT_MAX_ESTIMATED_TOKENS}). Truncating context.`
    );

    // Remove the full context layer and rebuild with only the most recent N steps
    const contextLayerIdx = layers.findIndex((l) => l.startsWith("=== CONTEXT FROM PRIOR STEPS ==="));
    if (contextLayerIdx !== -1) {
      // Progressively drop oldest context entries until we fit
      let truncatedParts = [...contextParts];
      while (truncatedParts.length > 1) {
        truncatedParts = truncatedParts.slice(1); // drop oldest
        const truncatedContext = `=== CONTEXT FROM PRIOR STEPS ===\n[TRUNCATED: keeping ${truncatedParts.length} most recent entries]\n${truncatedParts.join("\n\n")}`;
        layers[contextLayerIdx] = truncatedContext;
        assembled = layers.join("\n\n");
        if (estimateTokenCount(assembled) <= PROMPT_MAX_ESTIMATED_TOKENS) break;
      }

      // If still too large after keeping only 1 context entry, truncate the text itself
      if (estimateTokenCount(assembled) > PROMPT_MAX_ESTIMATED_TOKENS) {
        const maxChars = PROMPT_MAX_ESTIMATED_TOKENS * CHARS_PER_TOKEN_ESTIMATE;
        assembled = assembled.slice(0, maxChars);
        console.warn(
          `[PROMPT] Step "${stepName}" still exceeds limit after context truncation. Hard-truncated to ${maxChars} chars.`
        );
      }
    }
  }

  return assembled;
}
