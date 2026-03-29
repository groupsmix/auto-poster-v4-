// ============================================================
// Social Media Adaptation Engine
// Generates social-ready content per channel (Instagram, TikTok,
// Pinterest, LinkedIn, X/Twitter) with per-channel format rules
// ============================================================

import type { Env, ApiResponse } from "@nexus/shared";
import type { BaseProduct } from "./platform";

// --- Types ---

export interface ChannelRules {
  name: string;
  slug: string;
  caption_max_chars?: number;
  hashtag_count?: number;
  hook_max_chars?: number;
  title_max_chars?: number;
  description_max_chars?: number;
  post_max_chars?: number;
  tweet_max_chars?: number;
  thread_max_tweets?: number;
  tone?: string;
  format?: string;
  content_types?: string[];
}

// Per-channel output types

export interface InstagramContent {
  channel: "instagram";
  caption: string;
  hashtags: string[];
  content_type: "single image" | "carousel" | "reel script";
  notes: string;
}

export interface TikTokContent {
  channel: "tiktok";
  hook: string;
  video_script: string;
  content_type: "video script" | "hook + 3 points + CTA";
  notes: string;
}

export interface PinterestContent {
  channel: "pinterest";
  title: string;
  description: string;
  pin_format: string;
  notes: string;
}

export interface LinkedInContent {
  channel: "linkedin";
  post: string;
  content_type: "article post" | "insight post";
  notes: string;
}

export interface XTwitterContent {
  channel: "x_twitter";
  tweet: string;
  thread?: string[];
  content_type: "single tweet" | "thread";
  notes: string;
}

export type SocialContent =
  | InstagramContent
  | TikTokContent
  | PinterestContent
  | LinkedInContent
  | XTwitterContent;

// --- Default channel rules (from architecture doc Part 8) ---

const DEFAULT_CHANNEL_RULES: Record<string, ChannelRules> = {
  instagram: {
    name: "Instagram",
    slug: "instagram",
    caption_max_chars: 2200,
    hashtag_count: 30,
    tone: "Visual, aspirational, lifestyle-focused",
    format: "Hook line -> value -> CTA -> hashtags",
    content_types: ["single image", "carousel", "reel script"],
  },
  tiktok: {
    name: "TikTok",
    slug: "tiktok",
    hook_max_chars: 150,
    tone: "Fast, punchy, entertaining, trend-aware",
    format: "Strong hook (1-3 seconds) -> problem -> solution -> CTA",
    content_types: ["video script", "hook + 3 points + CTA"],
  },
  pinterest: {
    name: "Pinterest",
    slug: "pinterest",
    title_max_chars: 100,
    description_max_chars: 500,
    tone: "Inspirational, search-optimized, idea-focused",
    format: "Keyword-rich title -> what it is -> who it's for -> link",
    content_types: ["pin title + description"],
  },
  linkedin: {
    name: "LinkedIn",
    slug: "linkedin",
    post_max_chars: 3000,
    tone: "Professional, insight-driven, authority-building",
    format: "Bold opening statement -> 3-5 insights -> professional CTA",
    content_types: ["article post", "insight post"],
  },
  x_twitter: {
    name: "X/Twitter",
    slug: "x_twitter",
    tweet_max_chars: 280,
    thread_max_tweets: 10,
    tone: "Direct, witty, value-dense, conversation-starting",
    format: "Hook tweet -> 5-7 value tweets -> CTA tweet",
    content_types: ["single tweet", "thread"],
  },
};

// --- Per-channel output schemas ---

const OUTPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  instagram: {
    caption: "string (max 2200 chars, hook line first)",
    hashtags: ["string (relevant hashtags, max 30)"],
    content_type: "one of: single image | carousel | reel script",
    notes: "string (recommendations for visuals)",
  },
  tiktok: {
    hook: "string (max 150 chars, grabs attention in 1-3 seconds)",
    video_script: "string (problem -> solution -> CTA structure)",
    content_type: "one of: video script | hook + 3 points + CTA",
    notes: "string (trend suggestions, timing tips)",
  },
  pinterest: {
    title: "string (max 100 chars, keyword-rich)",
    description: "string (max 500 chars, search-optimized)",
    pin_format: "string (recommended pin format)",
    notes: "string (board suggestions, SEO tips)",
  },
  linkedin: {
    post: "string (max 3000 chars, professional tone, bold opening)",
    content_type: "one of: article post | insight post",
    notes: "string (engagement tips, best posting time)",
  },
  x_twitter: {
    tweet: "string (max 280 chars, hook tweet)",
    thread: ["string (value tweets, max 10 total including hook and CTA)"],
    content_type: "one of: single tweet | thread",
    notes: "string (engagement tips, reply strategy)",
  },
};

// --- Helper: call nexus-ai service binding ---

async function callAI(
  env: Env,
  prompt: string
): Promise<{ result: string; model: string; cached: boolean; tokens?: number }> {
  const response = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType: "social", prompt }),
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

// --- Helper: load channel rules from KV ---

async function loadChannelRules(
  env: Env,
  channelSlug: string
): Promise<ChannelRules> {
  try {
    const resp = await env.NEXUS_STORAGE.fetch(
      `http://nexus-storage/kv/channel:${channelSlug}`
    );
    const json = (await resp.json()) as ApiResponse<ChannelRules>;
    if (json.success && json.data) {
      return { ...DEFAULT_CHANNEL_RULES[channelSlug], ...json.data };
    }
  } catch {
    // Fall through to defaults
  }

  const defaults = DEFAULT_CHANNEL_RULES[channelSlug];
  if (defaults) return defaults;

  return {
    name: channelSlug,
    slug: channelSlug,
    tone: "Professional, engaging",
    format: "Hook -> value -> CTA",
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

// --- Build channel-specific prompt ---

function buildSocialPrompt(
  baseProduct: BaseProduct,
  rules: ChannelRules
): string {
  const constraintLines: string[] = [];

  if (rules.caption_max_chars) constraintLines.push(`Caption limit: ${rules.caption_max_chars} characters`);
  if (rules.hashtag_count) constraintLines.push(`Hashtag count: max ${rules.hashtag_count}`);
  if (rules.hook_max_chars) constraintLines.push(`Hook limit: ${rules.hook_max_chars} characters`);
  if (rules.title_max_chars) constraintLines.push(`Title limit: ${rules.title_max_chars} characters`);
  if (rules.description_max_chars) constraintLines.push(`Description limit: ${rules.description_max_chars} characters`);
  if (rules.post_max_chars) constraintLines.push(`Post limit: ${rules.post_max_chars} characters`);
  if (rules.tweet_max_chars) constraintLines.push(`Tweet limit: ${rules.tweet_max_chars} characters`);
  if (rules.thread_max_tweets) constraintLines.push(`Thread limit: max ${rules.thread_max_tweets} tweets`);

  const schema = OUTPUT_SCHEMAS[rules.slug] ?? OUTPUT_SCHEMAS.instagram;

  return `You are a social media content strategist and copywriter.

Channel: ${rules.name}
Tone: ${rules.tone ?? "Engaging"}
Format: ${rules.format ?? "Hook -> value -> CTA"}
Content types: ${rules.content_types?.join(", ") ?? "post"}
${constraintLines.length > 0 ? `\nConstraints:\n${constraintLines.map((l) => `- ${l}`).join("\n")}` : ""}

Take this base product and create social media content optimized for ${rules.name}.
The content should drive engagement and conversions on this specific platform.
Adapt the messaging, tone, and format to match what performs well on ${rules.name}.

Base product:
${JSON.stringify(baseProduct, null, 2)}

Output: JSON matching this exact schema:
${JSON.stringify(schema, null, 2)}`;
}

// --- Validation ---

function validateSocialContent(
  content: SocialContent,
  rules: ChannelRules
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  switch (content.channel) {
    case "instagram": {
      if (rules.caption_max_chars && content.caption.length > rules.caption_max_chars) {
        issues.push(`Caption exceeds ${rules.caption_max_chars} chars (got ${content.caption.length})`);
        content.caption = content.caption.slice(0, rules.caption_max_chars);
      }
      if (rules.hashtag_count && content.hashtags.length > rules.hashtag_count) {
        issues.push(`Too many hashtags: ${content.hashtags.length} (max ${rules.hashtag_count})`);
        content.hashtags = content.hashtags.slice(0, rules.hashtag_count);
      }
      break;
    }
    case "tiktok": {
      if (rules.hook_max_chars && content.hook.length > rules.hook_max_chars) {
        issues.push(`Hook exceeds ${rules.hook_max_chars} chars (got ${content.hook.length})`);
        content.hook = content.hook.slice(0, rules.hook_max_chars);
      }
      break;
    }
    case "pinterest": {
      if (rules.title_max_chars && content.title.length > rules.title_max_chars) {
        issues.push(`Title exceeds ${rules.title_max_chars} chars (got ${content.title.length})`);
        content.title = content.title.slice(0, rules.title_max_chars);
      }
      if (rules.description_max_chars && content.description.length > rules.description_max_chars) {
        issues.push(`Description exceeds ${rules.description_max_chars} chars (got ${content.description.length})`);
        content.description = content.description.slice(0, rules.description_max_chars);
      }
      break;
    }
    case "linkedin": {
      if (rules.post_max_chars && content.post.length > rules.post_max_chars) {
        issues.push(`Post exceeds ${rules.post_max_chars} chars (got ${content.post.length})`);
        content.post = content.post.slice(0, rules.post_max_chars);
      }
      break;
    }
    case "x_twitter": {
      if (rules.tweet_max_chars && content.tweet.length > rules.tweet_max_chars) {
        issues.push(`Tweet exceeds ${rules.tweet_max_chars} chars (got ${content.tweet.length})`);
        content.tweet = content.tweet.slice(0, rules.tweet_max_chars);
      }
      if (rules.thread_max_tweets && content.thread && content.thread.length > rules.thread_max_tweets) {
        issues.push(`Thread exceeds ${rules.thread_max_tweets} tweets (got ${content.thread.length})`);
        content.thread = content.thread.slice(0, rules.thread_max_tweets);
      }
      break;
    }
  }

  return { valid: issues.length === 0, issues };
}

// --- Helper: shape parsed AI output into typed SocialContent ---

function shapeContent(
  channel: string,
  parsed: Record<string, unknown>
): SocialContent {
  switch (channel) {
    case "instagram":
      return {
        channel: "instagram",
        caption: String(parsed.caption ?? ""),
        hashtags: Array.isArray(parsed.hashtags)
          ? parsed.hashtags.map(String)
          : [],
        content_type: (parsed.content_type as InstagramContent["content_type"]) ?? "single image",
        notes: String(parsed.notes ?? ""),
      };
    case "tiktok":
      return {
        channel: "tiktok",
        hook: String(parsed.hook ?? ""),
        video_script: String(parsed.video_script ?? ""),
        content_type: (parsed.content_type as TikTokContent["content_type"]) ?? "video script",
        notes: String(parsed.notes ?? ""),
      };
    case "pinterest":
      return {
        channel: "pinterest",
        title: String(parsed.title ?? ""),
        description: String(parsed.description ?? ""),
        pin_format: String(parsed.pin_format ?? "standard pin"),
        notes: String(parsed.notes ?? ""),
      };
    case "linkedin":
      return {
        channel: "linkedin",
        post: String(parsed.post ?? ""),
        content_type: (parsed.content_type as LinkedInContent["content_type"]) ?? "insight post",
        notes: String(parsed.notes ?? ""),
      };
    case "x_twitter":
      return {
        channel: "x_twitter",
        tweet: String(parsed.tweet ?? ""),
        thread: Array.isArray(parsed.thread) ? parsed.thread.map(String) : undefined,
        content_type: (parsed.content_type as XTwitterContent["content_type"]) ?? "single tweet",
        notes: String(parsed.notes ?? ""),
      };
    default:
      throw new Error(`Unknown social channel: ${channel}`);
  }
}

// ============================================================
// SocialAdaptationEngine
// ============================================================

export class SocialAdaptationEngine {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Generate social content for a single channel.
   */
  async generateSocialContent(
    baseProduct: BaseProduct,
    channelSlug: string
  ): Promise<{
    content: SocialContent;
    model: string;
    cached: boolean;
    validation: { valid: boolean; issues: string[] };
  }> {
    const rules = await loadChannelRules(this.env, channelSlug);
    const prompt = buildSocialPrompt(baseProduct, rules);
    const aiResult = await callAI(this.env, prompt);
    const parsed = parseAIResponse(aiResult.result);
    const content = shapeContent(channelSlug, parsed);
    const validation = validateSocialContent(content, rules);

    if (validation.issues.length > 0) {
      console.warn(
        `[SOCIAL] Validation issues for ${channelSlug}:`,
        validation.issues
      );
    }

    return {
      content,
      model: aiResult.model,
      cached: aiResult.cached,
      validation,
    };
  }

  /**
   * Generate social content for multiple channels.
   * Runs in parallel per channel for speed.
   */
  async generateAllSocialContent(
    baseProduct: BaseProduct,
    channelSlugs: string[]
  ): Promise<{
    contents: SocialContent[];
    errors: Array<{ channel: string; error: string }>;
  }> {
    const results = await Promise.allSettled(
      channelSlugs.map((slug) =>
        this.generateSocialContent(baseProduct, slug)
      )
    );

    const contents: SocialContent[] = [];
    const errors: Array<{ channel: string; error: string }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        contents.push(result.value.content);
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        errors.push({ channel: channelSlugs[i], error: message });
        console.error(
          `[SOCIAL] Failed to generate content for ${channelSlugs[i]}:`,
          message
        );
      }
    }

    return { contents, errors };
  }
}
