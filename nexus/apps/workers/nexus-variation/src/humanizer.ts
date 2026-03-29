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
  "in the ever-evolving landscape",
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
  "without further ado",

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
  "robust solution",
  "holistic approach",
  "best-in-class",
  "next-level",
  "state-of-the-art",
  "unlock your potential",
  "take it to the next level",
  "elevate your",
  "supercharge your",
  "skyrocket your",
  "turbocharge",
  "empower you",

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
  return `You are a human editor. Your job is to take AI-generated text and rewrite it to sound completely natural and human-written.

RULES:
1. Remove ALL AI patterns and clichés. The text currently contains these AI patterns:
${patternsFound.length > 0 ? patternsFound.map((p) => `   - "${p}"`).join("\n") : "   (none detected, but still check for subtle AI-ness)"}

2. Vary sentence length naturally:
   - Mix short punchy sentences with longer flowing ones
   - Humans don't write every sentence the same length
   - Use sentence fragments occasionally ("Worth it." "Not even close.")

3. Add natural imperfections:
   - Use contractions (don't, won't, it's, they're)
   - Occasionally start sentences with "And" or "But"
   - Use dashes for asides -- like this -- instead of always using commas
   - Throw in colloquialisms where appropriate

4. Use conversational transitions:
   - Instead of "Moreover" → "Plus" or "Oh, and"
   - Instead of "Furthermore" → "Here's the thing" or just start the next thought
   - Instead of "In conclusion" → just make your final point naturally
   - Instead of "It's worth noting" → just state the fact

5. Keep the SAME meaning and all factual information
6. Keep the SAME approximate length (don't dramatically shorten or lengthen)
7. The result should read like a knowledgeable human wrote it from scratch

TEXT TO HUMANIZE:
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

    // If already very human, skip AI call
    if (preScore >= 90 && patternsFound.length === 0) {
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
