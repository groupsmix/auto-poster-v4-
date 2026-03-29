// ============================================================
// Workflow Step Definitions — 9-step pipeline configuration
// Each step: task_type, role, prompt layers, output schema
// Domain-aware: POD vs Digital vs Content etc. may differ
// ============================================================

import type { TaskType } from "@nexus/shared";
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
    taskPrompt: `Conduct comprehensive market research for this product concept.

Find:
1. Current market trends and demand signals in this niche
2. Top competitors — what they sell, at what price, what works
3. Target audience — demographics, pain points, buying triggers
4. Optimal price range based on competitor analysis
5. High-value keywords with buyer intent
6. Untapped niche opportunities and angles

Be specific. Use real data patterns. No generic advice.
Every insight must be actionable for product creation.`,
    contextKeys: [],
    revisable: true,
  },

  strategy: {
    label: "Strategy",
    taskType: "research",
    role: "researcher",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Build a comprehensive product strategy based on the research findings.

Define:
1. Market positioning — how this product stands out
2. Unique angle — what makes this different from competitors
3. Target persona — detailed buyer profile
4. Value proposition — the core promise to the buyer
5. Competitive advantages — why buy THIS over alternatives
6. Pricing strategy — exact price with justification
7. Content direction — tone, style, approach for all copy
8. SEO strategy — keyword targeting approach

Every decision must reference the research data. No guessing.`,
    contextKeys: ["research"],
    revisable: true,
  },

  content_generation: {
    label: "Content Generation",
    taskType: "writing",
    role: "copywriter",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Create the complete product content package.

Generate:
1. Product name — memorable, SEO-friendly, niche-specific
2. Tagline — one sentence that sells the transformation
3. Full description — 2000-5000 words, human-quality, conversion-optimized
4. Feature list — specific, benefit-oriented features
5. Benefits — outcome-focused, emotional triggers
6. FAQ section — address real buyer objections
7. Use cases — specific scenarios showing product value

Follow the strategy decisions. Match the positioning and persona.
Write like a real expert human — zero AI-sounding output.
Every sentence must either build desire or eliminate doubt.`,
    contextKeys: ["research", "strategy"],
    revisable: true,
  },

  seo_optimization: {
    label: "SEO Optimization",
    taskType: "seo",
    role: "seo",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Optimize all content for maximum organic discoverability.

Create:
1. SEO title — keyword-rich, attention-grabbing, platform-appropriate length
2. Meta description — max 160 chars, includes primary keyword, has CTA
3. Primary keywords — 3-5 high-intent keywords
4. Secondary keywords — 5-10 supporting long-tail keywords
5. Tags — platform-optimized tag set
6. URL slug — clean, keyword-rich
7. Keyword density notes — where to naturally place keywords

Never sacrifice readability for keywords.
Best SEO reads like natural language.
Consider the target platforms and their specific SEO rules.`,
    contextKeys: ["research", "strategy", "content_generation"],
    revisable: true,
  },

  image_generation: {
    label: "Image Generation",
    taskType: "image",
    role: "copywriter",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `Create detailed image generation prompts for this product.

Generate:
1. Multiple image prompts — each with description, style, dimensions, purpose
2. Cover/hero image — the main product visual
3. Feature showcase images — highlighting key features
4. Lifestyle/context images — showing product in use
5. Mockup instructions — how to present the product on platforms
6. Thumbnail concept — optimized for small display (mobile browsing)

Consider the product type, target audience, and platform requirements.
Image prompts must be specific enough for AI image generators.
Think about what converts browsers to buyers visually.`,
    contextKeys: ["research", "strategy", "content_generation"],
    revisable: true,
  },

  platform_variants: {
    label: "Platform Variants",
    taskType: "variation",
    role: "copywriter",
    usesPlatformPrompt: true,
    usesVariationWorker: true,
    taskPrompt: `Rewrite the product listing for each target platform.

For EACH platform:
1. Adapt title to platform's character limit and tone
2. Rewrite description for platform's audience and style
3. Generate platform-specific tags within platform limits
4. Adjust pricing for platform's buyer psychology
5. Create platform-appropriate CTA
6. Add platform-specific notes

Do NOT copy the base listing. Fully adapt each variant.
Each platform has different buyers, different SEO, different tone.`,
    contextKeys: ["content_generation", "seo_optimization"],
    revisable: true,
  },

  social_content: {
    label: "Social Content",
    taskType: "social",
    role: "copywriter",
    usesPlatformPrompt: false,
    usesVariationWorker: true,
    taskPrompt: `Create social media content for each selected channel.

For EACH channel:
1. Write content matching the channel's format and tone
2. Create a strong hook that stops scrolling
3. Include relevant hashtags within channel limits
4. Add a clear CTA appropriate for the channel
5. Follow the channel's content format exactly

Each social channel has different audiences and expectations.
TikTok is fast and punchy. LinkedIn is professional and insightful.
Instagram is visual and aspirational. Pinterest is search-optimized.
X/Twitter is witty and value-dense.`,
    contextKeys: ["content_generation", "seo_optimization", "platform_variants"],
    revisable: true,
  },

  humanizer_pass: {
    label: "Humanizer Pass",
    taskType: "humanizer",
    role: "copywriter",
    usesPlatformPrompt: false,
    usesVariationWorker: true,
    taskPrompt: `Review ALL generated text and remove any AI-sounding patterns.

Check and fix:
1. Main product description — remove robotic phrases, add natural flow
2. All platform variants — ensure each sounds like a real seller wrote it
3. All social content — make it sound like a real person posting
4. Remove: "In today's...", "Whether you're...", "This comprehensive...", "Unlock the power of..."
5. Remove: excessive exclamation marks, corporate jargon, filler words
6. Add: natural sentence variation, conversational asides, personality

Track every change made. The goal is zero AI-detection.
Write like a real human expert, not a language model.`,
    contextKeys: ["content_generation", "platform_variants", "social_content"],
    revisable: true,
  },

  quality_review: {
    label: "Quality Review",
    taskType: "review",
    role: "reviewer",
    usesPlatformPrompt: false,
    usesVariationWorker: false,
    taskPrompt: `You are the CEO reviewing a product package before it goes to market.

Be extremely critical. Your standard: would YOU personally buy this?

Review the COMPLETE output package and score each criterion 1-10:
1. TITLE STRENGTH — attention-grabbing? SEO-optimized? platform-appropriate?
2. DESCRIPTION QUALITY — does it sell? is it human? answers buyer questions?
3. SEO QUALITY — right keywords? right density? platform-appropriate?
4. PRICE LOGIC — competitive? justified? psychologically optimized?
5. PLATFORM FIT — matches each platform's buyer psychology?
6. HUMAN QUALITY — does any part sound AI-generated or robotic?
7. OVERALL READINESS — is this ready to publish?

For any score below 8: state exactly what is wrong, what should change, and provide the corrected version.
Set approved=true ONLY if ALL individual scores are >= 8.`,
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
export function buildPromptForStep(
  stepName: StepName,
  product: ProductContext,
  priorOutputs: Partial<Record<StepName, Record<string, unknown>>>,
  promptTemplates: PromptTemplates,
  revisionFeedback?: string
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

  return layers.join("\n\n");
}
