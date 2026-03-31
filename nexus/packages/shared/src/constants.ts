// ============================================================
// NEXUS Shared Constants
// ============================================================

import type { TaskType } from "./types";

// --- Workflow Steps ---

/** Workflow step names in execution order */
export const WORKFLOW_STEPS = [
  "research",
  "strategy",
  "content_generation",
  "seo_optimization",
  "image_generation",
  "platform_variants",
  "social_content",
  "humanizer_pass",
  "quality_review",
] as const;

// --- Cache TTL ---

/** AI response cache TTLs by task type (in seconds) */
export const CACHE_TTL_MAP: Record<TaskType, number> = {
  research: 3600, // 1 hour
  writing: 86400, // 24 hours
  seo: 21600, // 6 hours
  code: 86400, // 24 hours
  variation: 86400, // 24 hours
  social: 86400, // 24 hours
  review: 0, // never cache
  image: 0, // never cache
  audio: 0, // never cache
  humanizer: 86400, // 24 hours (same as writing)
  reasoning: 3600, // 1 hour (same as research)
};

// --- Runtime Constants ---

/** Rate limit sleep duration (1 hour) */
export const RATE_LIMIT_SLEEP_MS = 3_600_000;

/** Maximum time to wait for a single workflow to complete (10 minutes) */
export const WORKFLOW_TIMEOUT_MS = 600_000;

/** Polling interval when waiting for workflow completion (5 seconds) */
export const BATCH_POLL_INTERVAL_MS = 5_000;

/** Maximum number of products in a single batch */
export const MAX_BATCH_SIZE = 10;

/** Default page size for paginated queries */
export const DEFAULT_PAGE_SIZE = 50;

/** KV list operation limit per call */
export const KV_LIST_LIMIT = 1000;

// --- Default Settings ---

/** Default settings values */
export const DEFAULT_SETTINGS = {
  social_posting_mode: "manual",
  default_language: "en",
  ceo_review_required: "true",
  auto_publish_after_approval: "false",
  batch_max_products: "10",
  cache_enabled: "true",
  ai_gateway_enabled: "true",
  auto_approve_threshold: "9",
  auto_revise_min_score: "7",
  max_auto_revisions: "2",
} as const;

/** Supported revenue tracker platforms */
export const REVENUE_PLATFORMS = ["etsy", "gumroad", "shopify"] as const;

/** Default scheduler interval in hours */
export const DEFAULT_SCHEDULER_INTERVAL_HOURS = 24;

/** Maximum products per scheduler run */
export const MAX_SCHEDULER_PRODUCTS_PER_RUN = 50;

/** Campaign statuses */
export const CAMPAIGN_STATUSES = [
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;

// --- Product Statuses ---

/** All supported product statuses */
export const PRODUCT_STATUSES = [
  "draft",
  "queued",
  "running",
  "pending_review",
  "approved",
  "rejected",
  "in_revision",
  "published",
  "cancelled",
] as const;

// --- Workers AI Models ---

/** Workers AI model identifiers (included free in $5 plan) */
export const WORKERS_AI_MODELS = {
  text: "@cf/meta/llama-3.1-8b-instruct",
  image: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  speech: "@cf/openai/whisper",
} as const;

// --- Default Domains & Categories (Part 3) ---

export interface DefaultDomain {
  name: string;
  slug: string;
  icon: string;
  categories: string[];
}

/** All 10 default domains with their categories */
export const DEFAULT_DOMAINS: readonly DefaultDomain[] = [
  {
    name: "Digital Products",
    slug: "digital-products",
    icon: "\u{1F4E6}",
    categories: [
      "Notion Templates",
      "PDF Guides & Ebooks",
      "Planners & Calendars",
      "Courses & E-Learning Modules",
      "Prompt Libraries",
      "SaaS Templates",
      "Checklists & Trackers",
      "Spreadsheet Templates",
      "AI Tool Kits",
      "Storybooks & Kids Books",
    ],
  },
  {
    name: "Print on Demand (POD)",
    slug: "print-on-demand",
    icon: "\u{1F455}",
    categories: [
      "T-Shirts & Apparel",
      "Mugs & Drinkware",
      "Posters & Wall Art",
      "Phone Cases",
      "Tote Bags",
      "Stickers & Decals",
      "Hoodies & Sweatshirts",
      "Home Decor",
      "Notebooks & Journals",
      "Hats & Accessories",
    ],
  },
  {
    name: "Content & Media",
    slug: "content-media",
    icon: "\u{1F3AC}",
    categories: [
      "Video Making (Scripts, Shorts, YouTube)",
      "Music Making (Loops, Intros, Sonic Logos)",
      "Podcast Content (Episodes, Show Notes)",
      "Animation Scripts",
      "Stock Photography Concepts",
      "3D Asset Descriptions",
      "B-roll Organization",
      "Visual Asset Packs",
    ],
  },
  {
    name: "Freelance Services",
    slug: "freelance-services",
    icon: "\u{1F4BC}",
    categories: [
      "Software Development (Web, SaaS, API)",
      "Technical Writing (Docs, White Papers)",
      "SEO & Digital Marketing Audits",
      "Legal & Compliance (Contracts, Policies)",
      "Business Operations (SOPs, Workflows)",
      "UI/UX Design Briefs",
      "Database Architecture",
      "Mobile App Development",
    ],
  },
  {
    name: "Affiliate Marketing",
    slug: "affiliate-marketing",
    icon: "\u{1F517}",
    categories: [
      "Software Comparison Articles",
      "Product Review Posts",
      "Top 10 Roundups",
      "Buying Guides",
      "Deal & Discount Newsletters",
      "Niche Blog Posts",
      "YouTube Script Reviews",
      "Email Sequences",
    ],
  },
  {
    name: "E-Commerce & Retail",
    slug: "e-commerce-retail",
    icon: "\u{1F6D2}",
    categories: [
      "Dropshipping Product Research",
      "Amazon FBA Listings",
      "Shopify Store Setup",
      "Inventory Management SOPs",
      "Marketplace Optimization",
      "Product Bundle Creation",
      "Supplier Research",
    ],
  },
  {
    name: "Knowledge & Education",
    slug: "knowledge-education",
    icon: "\u{1F4DA}",
    categories: [
      "Online Course Creation",
      "Workshop Materials",
      "Paid Newsletter Content",
      "Skill Certification Modules",
      "Coaching Plans (Fitness, Finance)",
      "Study Guides",
      "Training Manuals",
    ],
  },
  {
    name: "Specialized Technology",
    slug: "specialized-technology",
    icon: "\u{1F52C}",
    categories: [
      "AI Implementation Plans",
      "Cybersecurity Audit Reports",
      "Real Estate Listing Automation",
      "HealthTech Wellness Content",
      "No-Code Tool Builds",
      "PropTech Lead Systems",
    ],
  },
  {
    name: "Automation & No-Code",
    slug: "automation-no-code",
    icon: "\u2699\uFE0F",
    categories: [
      "Zapier/Make Workflow Designs",
      "n8n Automation Blueprints",
      "Airtable/Notion System Builds",
      "API Integration Docs",
      "Chatbot Flow Design",
      "CRM Automation Plans",
    ],
  },
  {
    name: "Space & Innovation",
    slug: "space-innovation",
    icon: "\u{1F680}",
    categories: [
      "Space Tourism Content",
      "Satellite Data Reports",
      "Space Merchandise Concepts",
      "Aerospace Research Briefs",
    ],
  },
] as const;

// --- Default Platform Rules (Part 7) ---

export interface PlatformRule {
  slug: string;
  name: string;
  title_max_chars: number;
  tag_count?: number;
  tag_max_chars?: number;
  audience: string;
  tone: string;
  seo_style: string;
  description_style: string;
  cta_style?: string;
  forbidden?: string[];
}

/** Default platform rules from architecture doc */
export const DEFAULT_PLATFORM_RULES: readonly PlatformRule[] = [
  {
    slug: "etsy",
    name: "Etsy",
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
  {
    slug: "gumroad",
    name: "Gumroad",
    title_max_chars: 100,
    tag_count: 10,
    audience: "Creators, solopreneurs, freelancers",
    tone: "Value-driven, outcome-focused, creator-to-creator",
    seo_style: "Problem -> solution keywords",
    description_style: "What you get + what problem it solves + who it's for",
    cta_style: "Download instantly, Start using today",
  },
  {
    slug: "shopify",
    name: "Shopify",
    title_max_chars: 70,
    audience: "Brand-conscious buyers, direct traffic",
    tone: "Clean, brand-driven, professional",
    seo_style: "Short-tail + brand keywords",
    description_style: "Benefits-first, scannable bullets, trust signals",
  },
  {
    slug: "redbubble",
    name: "Redbubble",
    title_max_chars: 60,
    tag_count: 15,
    audience: "Design lovers, pop culture fans, gift buyers",
    tone: "Fun, creative, trend-driven",
    seo_style: "Trend-driven, design-focused keywords",
    description_style: "Design-first, playful, trendy language",
  },
  {
    slug: "amazon_kdp",
    name: "Amazon KDP",
    title_max_chars: 200,
    audience: "Readers, learners, professional development seekers",
    tone: "Authority-driven, educational, trustworthy",
    seo_style: "Category-specific, high-volume keywords",
    description_style: "Book-style blurb, author authority, what reader will learn",
  },
] as const;

// --- Default Social Channel Rules (Part 8) ---

export interface SocialChannelRule {
  slug: string;
  name: string;
  caption_max_chars?: number;
  hashtag_count?: number;
  hook_max_chars?: number;
  title_max_chars?: number;
  description_max_chars?: number;
  post_max_chars?: number;
  tweet_max_chars?: number;
  thread_max_tweets?: number;
  tone: string;
  format: string;
  content_types: string[];
}

/** Default social channel rules from architecture doc */
export const DEFAULT_SOCIAL_CHANNEL_RULES: readonly SocialChannelRule[] = [
  {
    slug: "instagram",
    name: "Instagram",
    caption_max_chars: 2200,
    hashtag_count: 30,
    tone: "Visual, aspirational, lifestyle-focused",
    format: "Hook line -> value -> CTA -> hashtags",
    content_types: ["single image", "carousel", "reel script"],
  },
  {
    slug: "tiktok",
    name: "TikTok",
    hook_max_chars: 150,
    tone: "Fast, punchy, entertaining, trend-aware",
    format: "Strong hook (1-3 seconds) -> problem -> solution -> CTA",
    content_types: ["video script", "hook + 3 points + CTA"],
  },
  {
    slug: "pinterest",
    name: "Pinterest",
    title_max_chars: 100,
    description_max_chars: 500,
    tone: "Inspirational, search-optimized, idea-focused",
    format: "Keyword-rich title -> what it is -> who it's for -> link",
    content_types: ["pin title + description"],
  },
  {
    slug: "linkedin",
    name: "LinkedIn",
    post_max_chars: 3000,
    tone: "Professional, insight-driven, authority-building",
    format: "Bold opening statement -> 3-5 insights -> professional CTA",
    content_types: ["article post", "insight post"],
  },
  {
    slug: "x_twitter",
    name: "X / Twitter",
    tweet_max_chars: 280,
    thread_max_tweets: 10,
    tone: "Direct, witty, value-dense, conversation-starting",
    format: "Hook tweet -> 5-7 value tweets -> CTA tweet",
    content_types: ["single tweet", "thread"],
  },
] as const;
