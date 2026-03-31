// ============================================================
// Humanizer Pass
// Makes AI output sound human, not robotic.
// Uses humanizer AI chain: Doubao 1.5 Pro → DeepSeek-V3 →
// MiniMax M2.5 → Workers AI (fallback cascade).
// Removes AI patterns, varies sentence length, adds natural
// imperfections, uses conversational transitions.
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";

// --- Types ---

export interface HumanizeResult {
  original: string;
  humanized: string;
  human_score: number;
  model: string;
  cached: boolean;
  patterns_found: string[];
}

export interface HumanizedProduct {
  name: string;
  title?: string;
  description?: string;
  platform_variants?: Record<string, HumanizedField>;
  social_content?: Record<string, HumanizedField>;
  overall_human_score: number;
}

interface HumanizedField {
  original: string;
  humanized: string;
  human_score: number;
}

// --- Common AI patterns to detect and remove ---

const AI_PATTERNS = [
  // Opening clichés
  "in today's fast-paced world",
  "in today's digital age",
  "in today's competitive",
  "in today's ever",
  "in the ever-evolving landscape",
  "in the world of",
  "in this digital age",
  "in an increasingly connected world",
  "as we navigate",
  "it's no secret that",
  "have you ever wondered",
  "picture this",
  "imagine a world where",
  "let's face it",
  "let's dive in",
  "let's dive deep",
  "let's explore",
  "let's delve",
  "without further ado",
  "are you ready to",
  "looking to take your",
  "ready to transform",
  "welcome to the world of",
  "welcome to our",
  "introducing our",

  // Buzzwords
  "game-changer",
  "game changer",
  "leverage",
  "synergy",
  "paradigm shift",
  "cutting-edge",
  "cutting edge",
  "groundbreaking",
  "revolutionary",
  "innovative solution",
  "seamless integration",
  "seamless experience",
  "seamlessly",
  "robust solution",
  "robust and",
  "holistic approach",
  "best-in-class",
  "next-level",
  "state-of-the-art",
  "unlock your potential",
  "unlock the power",
  "unlock the full",
  "take it to the next level",
  "elevate your",
  "supercharge your",
  "skyrocket your",
  "turbocharge",
  "empower you",
  "empowering",
  "streamline your",
  "optimize your workflow",
  "maximize your",
  "revolutionize your",
  "transform your",
  "comprehensive solution",
  "comprehensive guide",
  "this comprehensive",
  "this innovative",
  "this powerful",
  "this unique",
  "delve into",
  "delve deeper",
  "navigate the",
  "navigate through",
  "curated",
  "meticulously",
  "thoughtfully designed",
  "carefully crafted",
  "masterfully",
  "effortlessly",

  // Transition clichés
  "moreover",
  "furthermore",
  "in conclusion",
  "to sum up",
  "all in all",
  "at the end of the day",
  "having said that",
  "it goes without saying",
  "needless to say",
  "it's worth noting that",
  "it's important to note",
  "it's important to remember",
  "additionally",
  "consequently",
  "in essence",
  "in summary",
  "to that end",
  "with that being said",
  "that being said",

  // Filler
  "absolutely",
  "literally",
  "essentially",
  "basically",
  "certainly",
  "undoubtedly",
  "incredibly",
  "remarkably",
  "significantly",
  "tremendously",
  "ultimately",
  "arguably",
  "interestingly",
  "notably",

  // Hedging (AI loves to hedge)
  "it's worth mentioning",
  "it should be noted",
  "one might argue",
  "it can be said",

  // Whether you're patterns
  "whether you're a",
  "whether you're looking",
  "whether you're new",
  "whether you need",
  "regardless of whether",

  // AI self-references
  "as an ai",
  "as a language model",
  "i don't have personal",
  "i cannot provide",
];

// --- Helper: detect AI patterns in text ---

function detectAIPatterns(text: string): string[] {
  const lower = text.toLowerCase();
  return AI_PATTERNS.filter((pattern) => lower.includes(pattern));
}

// --- Helper: compute a basic human score (0-100) ---

function computeHumanScore(text: string): number {
  let score = 100;
  const lower = text.toLowerCase();

  // Penalize for AI patterns found
  const patternsFound = AI_PATTERNS.filter((p) => lower.includes(p));
  score -= patternsFound.length * 5;

  // Penalize for uniform sentence lengths (AI tends to write same-length sentences)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 2) {
    const lengths = sentences.map((s) => s.trim().length);
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    // Low variance = robotic
    if (stdDev < 10) score -= 10;
    if (stdDev < 5) score -= 10;
  }

  // Penalize for excessive exclamation marks (AI overuses them)
  const exclamations = (text.match(/!/g) ?? []).length;
  if (exclamations > 3) score -= (exclamations - 3) * 2;

  // Penalize for excessive emoji usage
  const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) ?? []).length;
  if (emojiCount > 5) score -= (emojiCount - 5) * 2;

  // Penalize for too many bullet-point lists (AI loves them)
  const bulletLines = (text.match(/^[\s]*[-•*]\s/gm) ?? []).length;
  if (bulletLines > 8) score -= (bulletLines - 8) * 2;

  // Penalize for lack of contractions (humans almost always use contractions)
  const noContractions = !lower.includes("don't") && !lower.includes("won't") &&
    !lower.includes("it's") && !lower.includes("they're") &&
    !lower.includes("you're") && !lower.includes("we're") &&
    !lower.includes("can't") && !lower.includes("doesn't");
  if (noContractions && sentences.length > 3) score -= 8;

  // Penalize for starting multiple sentences the same way (AI repetition pattern)
  if (sentences.length > 4) {
    const starters = sentences.map((s) => s.trim().split(/\s+/)[0]?.toLowerCase() ?? "");
    const starterCounts: Record<string, number> = {};
    for (const s of starters) {
      starterCounts[s] = (starterCounts[s] ?? 0) + 1;
    }
    const maxRepeat = Math.max(...Object.values(starterCounts));
    if (maxRepeat > 3) score -= (maxRepeat - 3) * 3;
  }

  return Math.max(0, Math.min(100, score));
}

// --- Helper: call nexus-ai service binding ---

async function callAI(
  env: Env,
  prompt: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType: "humanizer", prompt }),
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

// --- The humanizer prompt ---

function buildHumanizerPrompt(content: string, patternsFound: string[]): string {
  return `You are a senior copywriter with 15 years of e-commerce experience. You've written thousands of product listings that have generated millions in revenue. Your job: take this AI-generated text and rewrite it so it's IMPOSSIBLE to detect as AI-written. Zero AI-detection score is the target.

=== AI PATTERNS DETECTED ===
${patternsFound.length > 0 ? patternsFound.map((p) => `- "${p}" ← MUST BE REMOVED or replaced with natural alternative`).join("\n") : "(none detected by scanner, but still check for subtle AI-ness — the scanner doesn't catch everything)"}

=== HUMANIZATION RULES ===

1. REMOVE all AI patterns listed above. Replace them with how a real expert human would phrase the same idea.

2. VARY sentence length naturally:
   - Mix short punchy sentences (5-8 words) with longer flowing ones (15-25 words)
   - Add occasional sentence fragments: "Worth it." "Not even close." "Game over."
   - Never write 3+ sentences in a row that are the same length

3. USE contractions — humans almost always use them:
   - "do not" → "don't", "will not" → "won't", "it is" → "it's"
   - "they are" → "they're", "you are" → "you're", "cannot" → "can't"

4. ADD natural sentence starters:
   - Start some sentences with "And" or "But" — it's natural
   - Use dashes for asides — like this — instead of always using commas
   - Vary your sentence openers (never start 3+ sentences the same way)

5. REPLACE formal transitions:
   - "Moreover" → "Plus" or "Oh, and" or just start the next thought
   - "Furthermore" → "Here's the thing" or drop it entirely
   - "In conclusion" → just make the final point naturally
   - "Additionally" → "And" or just start the sentence
   - "It's worth noting" → just state the fact directly

6. KEEP the same meaning, facts, and approximate length
7. The result must read like a knowledgeable human expert wrote it from scratch — NOT like AI text that was "cleaned up"

=== EXAMPLE OF GOOD HUMANIZATION ===

AI VERSION: "This comprehensive digital planner is designed to help you streamline your daily workflow. Whether you're a busy professional or a student, this innovative tool will empower you to take your productivity to the next level. It's worth noting that the template includes 50+ pages of meticulously crafted content."

HUMAN VERSION: "50+ pages. Every single one designed to actually get used — not just look pretty in your Notion workspace. I built this after burning through a dozen planners that collected digital dust. The daily layout works because it's flexible. Miss a day? No guilt spirals. Just pick up where you left off."

NOTICE: The human version uses contractions, varied sentence lengths, fragments, personal voice, specific details, and zero AI buzzwords.

=== TEXT TO HUMANIZE ===
---
${content}
---

Return ONLY the humanized text. No explanations, no meta-commentary, no "Here's the rewritten version:". Just the text itself.`;
}

// ============================================================
// Humanizer
// ============================================================

export class Humanizer {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Humanize a single piece of text content.
   */
  async humanizeContent(content: string): Promise<HumanizeResult> {
    if (!content || content.trim().length === 0) {
      return {
        original: content,
        humanized: content,
        human_score: 100,
        model: "none",
        cached: false,
        patterns_found: [],
      };
    }

    const patternsFound = detectAIPatterns(content);
    const preScore = computeHumanScore(content);

    // If already very human, skip AI call (threshold raised to 95 for stricter humanization)
    if (preScore >= 95 && patternsFound.length === 0) {
      return {
        original: content,
        humanized: content,
        human_score: preScore,
        model: "passthrough",
        cached: false,
        patterns_found: [],
      };
    }

    const prompt = buildHumanizerPrompt(content, patternsFound);
    const aiResult = await callAI(this.env, prompt);

    // Clean up result (remove any wrapping quotes or markdown)
    let humanized = aiResult.result.trim();
    if (humanized.startsWith('"') && humanized.endsWith('"')) {
      humanized = humanized.slice(1, -1);
    }
    if (humanized.startsWith("```") && humanized.endsWith("```")) {
      humanized = humanized.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
    }

    const postScore = computeHumanScore(humanized);

    return {
      original: content,
      humanized,
      human_score: postScore,
      model: aiResult.model,
      cached: aiResult.cached,
      patterns_found: patternsFound,
    };
  }

  /**
   * Humanize all text fields of a product (title, description,
   * all platform variants, all social content).
   */
  async humanizeProduct(product: {
    name: string;
    title?: string;
    description?: string;
    platform_variants?: Record<string, { title: string; description: string }>;
    social_content?: Record<string, { caption?: string; post?: string; tweet?: string; hook?: string; title?: string; description?: string }>;
  }): Promise<HumanizedProduct> {
    const scores: number[] = [];

    // Humanize title
    let humanizedTitle: string | undefined;
    if (product.title) {
      const result = await this.humanizeContent(product.title);
      humanizedTitle = result.humanized;
      scores.push(result.human_score);
    }

    // Humanize description
    let humanizedDesc: string | undefined;
    if (product.description) {
      const result = await this.humanizeContent(product.description);
      humanizedDesc = result.humanized;
      scores.push(result.human_score);
    }

    // Humanize platform variants
    const humanizedVariants: Record<string, HumanizedField> = {};
    if (product.platform_variants) {
      for (const [platform, variant] of Object.entries(product.platform_variants)) {
        // Combine title + description for a single humanizer pass
        const combined = `TITLE: ${variant.title}\n\nDESCRIPTION: ${variant.description}`;
        const result = await this.humanizeContent(combined);

        // Split result back into title + description
        const titleMatch = result.humanized.match(/TITLE:\s*(.*?)(?:\n\nDESCRIPTION:|$)/s);
        const descMatch = result.humanized.match(/DESCRIPTION:\s*([\s\S]*)/);

        const humanizedCombined = titleMatch?.[1]?.trim() && descMatch?.[1]?.trim()
          ? `${titleMatch[1].trim()}\n\n${descMatch[1].trim()}`
          : result.humanized;

        humanizedVariants[platform] = {
          original: combined,
          humanized: humanizedCombined,
          human_score: result.human_score,
        };
        scores.push(result.human_score);
      }
    }

    // Humanize social content
    const humanizedSocial: Record<string, HumanizedField> = {};
    if (product.social_content) {
      for (const [channel, content] of Object.entries(product.social_content)) {
        // Get the primary text field for each channel
        const textField =
          content.caption ??
          content.post ??
          content.tweet ??
          content.hook ??
          content.description ??
          content.title ??
          "";

        if (textField) {
          const result = await this.humanizeContent(textField);
          humanizedSocial[channel] = {
            original: textField,
            humanized: result.humanized,
            human_score: result.human_score,
          };
          scores.push(result.human_score);
        }
      }
    }

    // Overall score = average of all individual scores
    const overall =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 100;

    return {
      name: product.name,
      title: humanizedTitle,
      description: humanizedDesc,
      platform_variants:
        Object.keys(humanizedVariants).length > 0
          ? humanizedVariants
          : undefined,
      social_content:
        Object.keys(humanizedSocial).length > 0
          ? humanizedSocial
          : undefined,
      overall_human_score: overall,
    };
  }
}
