/**
 * Centralized mock/fallback data for all pages.
 * Imported by pages when API is not available.
 * Cross-references are consistent (product IDs match across collections).
 */

import type {
  Product,
  ReviewItem,
  PublishableProduct,
  Asset,
  WorkflowRun,
  WorkflowStep,
  RevisionEntry,
  PromptTemplate,
  PromptVersion,
  AnalyticsSummary,
  AIUsageOverTime,
  CostBreakdownItem,
  CacheHitTrendItem,
  DomainBreakdownItem,
  CategoryBreakdownItem,
  AILeaderboardEntry,
  AnalyticsDashboard,
  APIKeyEntry,
  PlatformFull,
  SocialChannelFull,
} from "@/lib/api";

// ─── Products ────────────────────────────────────────────────────────

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-001",
    domain_id: "d1",
    category_id: "c1",
    name: "Freelancer CRM System — Notion Template",
    niche: "freelancers",
    language: "en",
    batch_id: "batch-001",
    status: "approved",
    created_at: "2025-03-15T10:30:00Z",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    platforms: ["Etsy", "Gumroad"],
  },
  {
    id: "prod-002",
    domain_id: "d1",
    category_id: "c1",
    name: "Student Planner — Notion Template",
    niche: "students",
    language: "en",
    batch_id: "batch-001",
    status: "pending_review",
    created_at: "2025-03-15T10:35:00Z",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    platforms: ["Etsy", "Gumroad", "Payhip"],
  },
  {
    id: "prod-003",
    domain_id: "d1",
    category_id: "c2",
    name: "Ultimate SEO Checklist — PDF Guide",
    niche: "marketers",
    language: "en",
    status: "published",
    created_at: "2025-03-10T08:00:00Z",
    domain_name: "Digital Products",
    category_name: "PDF Guides & Ebooks",
    platforms: ["Gumroad"],
  },
  {
    id: "prod-004",
    domain_id: "d2",
    category_id: "c3",
    name: "Minimalist Mountain T-Shirt Design",
    niche: "outdoor enthusiasts",
    language: "en",
    batch_id: "batch-002",
    status: "in_revision",
    created_at: "2025-03-12T14:00:00Z",
    domain_name: "Print on Demand (POD)",
    category_name: "T-Shirts & Apparel",
    platforms: ["Redbubble"],
  },
  {
    id: "prod-005",
    domain_id: "d2",
    category_id: "c3",
    name: "Retro Sunset Graphic Tee",
    niche: "retro lovers",
    language: "en",
    batch_id: "batch-002",
    status: "draft",
    created_at: "2025-03-12T14:05:00Z",
    domain_name: "Print on Demand (POD)",
    category_name: "T-Shirts & Apparel",
    platforms: ["Redbubble", "TeeSpring"],
  },
  {
    id: "prod-006",
    domain_id: "d3",
    category_id: "c4",
    name: "Podcast Launch Blueprint",
    niche: "content creators",
    language: "en",
    status: "approved",
    created_at: "2025-03-08T09:00:00Z",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    platforms: ["Gumroad", "Payhip"],
  },
  {
    id: "prod-007",
    domain_id: "d1",
    category_id: "c1",
    name: "Project Manager Dashboard — Notion",
    niche: "project managers",
    language: "en",
    batch_id: "batch-001",
    status: "running",
    created_at: "2025-03-15T10:40:00Z",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    platforms: ["Etsy"],
  },
];

// ─── Review ──────────────────────────────────────────────────────────

export const MOCK_PENDING: ReviewItem[] = [
  {
    id: "rev-001",
    product_id: "prod-002",
    product_name: "Student Planner — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    ai_score: 8.7,
    ai_model: "DeepSeek-V3",
    version: 1,
    reviewed_at: "2025-03-15T11:00:00Z",
    status: "pending_review",
  },
  {
    id: "rev-002",
    product_id: "prod-008",
    product_name: "Fitness Coaching Plan — PDF",
    domain_name: "Knowledge & Education",
    category_name: "Coaching Plans",
    ai_score: 7.9,
    ai_model: "Qwen 3.5 Max",
    version: 1,
    reviewed_at: "2025-03-14T16:30:00Z",
    status: "pending_review",
  },
  {
    id: "rev-003",
    product_id: "prod-009",
    product_name: "SaaS Landing Page Template",
    domain_name: "Digital Products",
    category_name: "SaaS Templates",
    ai_score: 9.1,
    ai_model: "DeepSeek-R1",
    version: 1,
    reviewed_at: "2025-03-14T14:00:00Z",
    status: "pending_review",
  },
];

export const MOCK_IN_REVISION: ReviewItem[] = [
  {
    id: "rev-004",
    product_id: "prod-004",
    product_name: "Minimalist Mountain T-Shirt Design",
    domain_name: "Print on Demand (POD)",
    category_name: "T-Shirts & Apparel",
    ai_score: 6.5,
    ai_model: "DeepSeek-V3",
    decision: "rejected",
    feedback: "Design needs more contrast and the text is too small for print",
    version: 2,
    reviewed_at: "2025-03-13T10:00:00Z",
    status: "in_revision",
  },
];

export const MOCK_REVIEW_HISTORY: ReviewItem[] = [
  {
    id: "rev-005",
    product_id: "prod-001",
    product_name: "Freelancer CRM System — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    ai_score: 8.4,
    ai_model: "DeepSeek-V3",
    decision: "approved",
    version: 1,
    reviewed_at: "2025-03-15T12:00:00Z",
    status: "approved",
  },
  {
    id: "rev-006",
    product_id: "prod-003",
    product_name: "Ultimate SEO Checklist — PDF Guide",
    domain_name: "Digital Products",
    category_name: "PDF Guides & Ebooks",
    ai_score: 9.2,
    ai_model: "DeepSeek-R1",
    decision: "approved",
    version: 1,
    reviewed_at: "2025-03-10T10:00:00Z",
    status: "approved",
  },
  {
    id: "rev-007",
    product_id: "prod-006",
    product_name: "Podcast Launch Blueprint",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    ai_score: 7.8,
    ai_model: "Qwen 3.5 Max",
    decision: "rejected",
    feedback: "Title too generic, needs more specificity",
    version: 1,
    reviewed_at: "2025-03-08T11:00:00Z",
    status: "rejected",
  },
  {
    id: "rev-008",
    product_id: "prod-006",
    product_name: "Podcast Launch Blueprint",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    ai_score: 8.9,
    ai_model: "DeepSeek-V3",
    decision: "approved",
    version: 2,
    reviewed_at: "2025-03-08T14:00:00Z",
    status: "approved",
  },
];

// ─── Publishing ──────────────────────────────────────────────────────

export const MOCK_PUBLISHABLE: PublishableProduct[] = [
  {
    id: "pub-001",
    product_id: "prod-001",
    product_name: "Freelancer CRM System — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    ai_score: 8.4,
    status: "approved",
    posting_mode: "manual",
    platform_variants: [
      {
        platform: "Etsy",
        title: "Freelancer CRM Notion Template | Client Tracker & Invoice Manager",
        description:
          "Stay organized with this all-in-one Freelancer CRM Notion template. Track clients, manage invoices, and visualize your pipeline.",
        tags: ["notion template", "freelancer", "crm", "client tracker"],
        price: 19.99,
        scores: { seo: 9, title: 8, tags: 8 },
      },
      {
        platform: "Gumroad",
        title: "The Ultimate Freelancer CRM — Notion Template Pack",
        description:
          "Everything you need to manage your freelance business. Client management, invoicing, project tracking, and dashboards.",
        tags: ["notion", "freelance", "crm", "productivity"],
        price: 24.99,
        scores: { seo: 8, title: 9, tags: 7 },
      },
    ],
    social_variants: [
      {
        channel: "Instagram",
        caption:
          "Stop losing clients in your DMs. This Freelancer CRM Notion template tracks everything.",
        hashtags: ["freelancer", "notiontemplate", "crm", "productivity"],
        post_type: "Carousel",
      },
      {
        channel: "TikTok",
        caption:
          "POV: You finally organize your freelance business with ONE Notion template.",
        hashtags: ["freelancertips", "notionsetup", "productivityhack"],
        post_type: "Short Video",
      },
      {
        channel: "X/Twitter",
        caption:
          "Built a Notion CRM template for freelancers.\n\nIt tracks:\n- Clients & leads\n- Invoices & payments\n- Projects & deadlines",
        hashtags: ["notion", "freelance", "buildinpublic"],
        post_type: "Thread",
      },
    ],
  },
  {
    id: "pub-002",
    product_id: "prod-006",
    product_name: "Podcast Launch Blueprint",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    ai_score: 8.9,
    status: "approved",
    posting_mode: "auto",
    platform_variants: [
      {
        platform: "Gumroad",
        title: "Podcast Launch Blueprint — Complete Starter Guide",
        description:
          "Launch your podcast with confidence. This blueprint covers equipment, hosting, editing, distribution, and growth strategies.",
        tags: ["podcast", "content creation", "blueprint", "guide"],
        price: 14.99,
        scores: { seo: 8, title: 8, tags: 9 },
      },
      {
        platform: "Payhip",
        title: "The Podcast Launch Blueprint",
        description:
          "Everything you need to start and grow your podcast — from idea to first 1000 listeners.",
        tags: ["podcast", "launch", "guide", "creator"],
        price: 12.99,
        scores: { seo: 7, title: 9, tags: 8 },
      },
    ],
    social_variants: [
      {
        channel: "Instagram",
        caption:
          "Ready to launch your podcast? This blueprint covers everything from equipment to growth.",
        hashtags: ["podcast", "contentcreator", "podcastlaunch"],
        post_type: "Carousel",
      },
    ],
  },
];

// ─── Content / Assets ────────────────────────────────────────────────

export const MOCK_ASSETS: Asset[] = [
  {
    id: "asset-001",
    product_id: "prod-001",
    product_name: "Freelancer CRM System — Notion Template",
    asset_type: "image",
    r2_key: "assets/prod-001/cover.png",
    cf_image_id: "cf-img-001",
    url: "https://placehold.co/800x600/1a1a2e/6366f1?text=CRM+Cover",
    metadata: { width: 800, height: 600, format: "png" },
    created_at: "2025-03-15T10:32:00Z",
  },
  {
    id: "asset-002",
    product_id: "prod-001",
    product_name: "Freelancer CRM System — Notion Template",
    asset_type: "image",
    r2_key: "assets/prod-001/mockup.png",
    cf_image_id: "cf-img-002",
    url: "https://placehold.co/800x600/1a1a2e/22c55e?text=CRM+Mockup",
    metadata: { width: 800, height: 600, format: "png" },
    created_at: "2025-03-15T10:33:00Z",
  },
  {
    id: "asset-003",
    product_id: "prod-003",
    product_name: "Ultimate SEO Checklist — PDF Guide",
    asset_type: "pdf",
    r2_key: "assets/prod-003/seo-checklist.pdf",
    url: "https://placehold.co/400x560/1a1a2e/ef4444?text=SEO+PDF",
    metadata: { pages: 12, size_mb: 2.4 },
    created_at: "2025-03-10T08:05:00Z",
  },
  {
    id: "asset-004",
    product_id: "prod-006",
    product_name: "Podcast Launch Blueprint",
    asset_type: "audio",
    r2_key: "assets/prod-006/intro.mp3",
    url: "/audio/intro.mp3",
    metadata: { duration_seconds: 45, format: "mp3", size_mb: 1.1 },
    created_at: "2025-03-08T09:10:00Z",
  },
  {
    id: "asset-005",
    product_id: "prod-004",
    product_name: "Minimalist Mountain T-Shirt Design",
    asset_type: "mockup",
    r2_key: "assets/prod-004/tshirt-mockup.png",
    cf_image_id: "cf-img-005",
    url: "https://placehold.co/800x800/1a1a2e/f59e0b?text=T-Shirt+Mockup",
    metadata: { width: 800, height: 800, format: "png" },
    created_at: "2025-03-12T14:05:00Z",
  },
  {
    id: "asset-006",
    product_id: "prod-002",
    product_name: "Student Planner — Notion Template",
    asset_type: "image",
    r2_key: "assets/prod-002/cover.png",
    cf_image_id: "cf-img-006",
    url: "https://placehold.co/800x600/1a1a2e/818cf8?text=Planner+Cover",
    metadata: { width: 800, height: 600, format: "png" },
    created_at: "2025-03-15T10:37:00Z",
  },
];

// ─── History / Workflow Runs ─────────────────────────────────────────

export const MOCK_RUNS: WorkflowRun[] = [
  {
    id: "run-001",
    product_id: "prod-001",
    product_name: "Freelancer CRM System — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    batch_id: "batch-001",
    status: "completed",
    started_at: "2025-03-15T10:30:00Z",
    completed_at: "2025-03-15T10:31:15Z",
    total_tokens: 18420,
    total_cost: 0.0,
    cache_hits: 2,
    ai_models_used: ["DeepSeek-R1", "Qwen-Plus", "Llama 3.1 8B"],
    duration_ms: 75000,
  },
  {
    id: "run-002",
    product_id: "prod-002",
    product_name: "Student Planner — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    batch_id: "batch-001",
    status: "completed",
    started_at: "2025-03-15T10:35:00Z",
    completed_at: "2025-03-15T10:36:02Z",
    total_tokens: 15800,
    total_cost: 0.0,
    cache_hits: 3,
    ai_models_used: ["DeepSeek-R1", "Qwen-Plus"],
    duration_ms: 62000,
  },
  {
    id: "run-003",
    product_id: "prod-003",
    product_name: "Ultimate SEO Checklist — PDF Guide",
    domain_name: "Digital Products",
    category_name: "PDF Guides & Ebooks",
    status: "completed",
    started_at: "2025-03-10T08:00:00Z",
    completed_at: "2025-03-10T08:01:30Z",
    total_tokens: 22100,
    total_cost: 0.0,
    cache_hits: 1,
    ai_models_used: ["DeepSeek-R1", "Qwen-Plus", "Mixtral 8x7B"],
    duration_ms: 90000,
  },
  {
    id: "run-004",
    product_id: "prod-004",
    product_name: "Minimalist Mountain T-Shirt Design",
    domain_name: "Print on Demand (POD)",
    category_name: "T-Shirts & Apparel",
    batch_id: "batch-002",
    status: "failed",
    started_at: "2025-03-12T14:00:00Z",
    completed_at: "2025-03-12T14:00:45Z",
    total_tokens: 8400,
    total_cost: 0.0,
    cache_hits: 0,
    ai_models_used: ["DeepSeek-R1"],
    duration_ms: 45000,
  },
  {
    id: "run-005",
    product_id: "prod-006",
    product_name: "Podcast Launch Blueprint",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    status: "cancelled",
    started_at: "2025-03-08T09:00:00Z",
    completed_at: "2025-03-08T09:00:20Z",
    total_tokens: 3200,
    total_cost: 0.0,
    cache_hits: 0,
    ai_models_used: ["Qwen-Plus"],
    duration_ms: 20000,
  },
];

export const MOCK_STEPS: Record<string, WorkflowStep[]> = {
  "run-001": [
    { id: "s1", run_id: "run-001", step_name: "Research", step_order: 1, status: "completed", ai_used: "DeepSeek-R1", ai_tried: ["DeepSeek-R1"], tokens_used: 3200, cost: 0, cached: true, latency_ms: 120 },
    { id: "s2", run_id: "run-001", step_name: "Content Generation", step_order: 2, status: "completed", ai_used: "DeepSeek-R1", ai_tried: ["DeepSeek-R1"], tokens_used: 4800, cost: 0, cached: false, latency_ms: 2400 },
    { id: "s3", run_id: "run-001", step_name: "SEO Optimization", step_order: 3, status: "completed", ai_used: "Qwen-Plus", ai_tried: ["DeepSeek-R1", "Qwen-Plus"], tokens_used: 2100, cost: 0, cached: true, latency_ms: 80 },
    { id: "s4", run_id: "run-001", step_name: "Title & Tags", step_order: 4, status: "completed", ai_used: "Qwen-Plus", ai_tried: ["Qwen-Plus"], tokens_used: 1800, cost: 0, cached: false, latency_ms: 1200 },
    { id: "s5", run_id: "run-001", step_name: "Description", step_order: 5, status: "completed", ai_used: "DeepSeek-R1", ai_tried: ["DeepSeek-R1"], tokens_used: 2400, cost: 0, cached: false, latency_ms: 1800 },
    { id: "s6", run_id: "run-001", step_name: "Pricing", step_order: 6, status: "completed", ai_used: "Llama 3.1 8B", ai_tried: ["Llama 3.1 8B"], tokens_used: 800, cost: 0, cached: false, latency_ms: 400 },
    { id: "s7", run_id: "run-001", step_name: "Image Generation", step_order: 7, status: "completed", ai_used: "FLUX", ai_tried: ["FLUX"], tokens_used: 0, cost: 0, cached: false, latency_ms: 8000 },
    { id: "s8", run_id: "run-001", step_name: "CEO Review", step_order: 8, status: "completed", ai_used: "DeepSeek-R1", ai_tried: ["DeepSeek-R1"], tokens_used: 1820, cost: 0, cached: false, latency_ms: 2200 },
    { id: "s9", run_id: "run-001", step_name: "Platform Variation", step_order: 9, status: "completed", ai_used: "Qwen-Plus", ai_tried: ["Qwen-Plus"], tokens_used: 1500, cost: 0, cached: false, latency_ms: 1600 },
  ],
};

export const MOCK_REVISIONS: Record<string, RevisionEntry[]> = {
  "prod-001": [
    { id: "rev-1", product_id: "prod-001", version: 1, feedback: "Title too generic, make it more niche-specific", ai_score: 6.8, ai_model: "DeepSeek-R1", reviewed_at: "2025-03-15T10:31:00Z", decision: "rejected" },
    { id: "rev-2", product_id: "prod-001", version: 2, ai_score: 8.4, ai_model: "DeepSeek-R1", reviewed_at: "2025-03-15T10:32:30Z", decision: "approved" },
  ],
};

// ─── Prompts ─────────────────────────────────────────────────────────

export const MOCK_PROMPTS: PromptTemplate[] = [
  {
    id: "p-master",
    layer: "master",
    target_id: null,
    name: "Master System Prompt",
    prompt: `You are NEXUS — a world-class AI business engine.

You operate with the mindset of:
- A senior marketing strategist with 15 years of e-commerce experience
- A professional copywriter who understands consumer psychology deeply
- An SEO specialist who knows how platforms rank and reward listings
- A creative director who understands what converts browsers to buyers

Core rules you ALWAYS follow:
1. Never produce generic AI-sounding output. Write like a real expert human.
2. Always think about the END BUYER — their emotions, desires, fears, language.
3. Always optimize for the specific platform's algorithm and buyer behavior.
4. Always produce output in the exact JSON schema specified.
5. If something is missing from your instructions, make the smartest decision.
6. Quality over speed. Every word should earn its place.`,
    version: 3,
    is_active: true,
    updated_at: "2025-03-20T10:00:00Z",
  },
  {
    id: "p-role-researcher",
    layer: "role",
    target_id: "researcher",
    name: "Researcher Role",
    prompt: `Your role: Senior Market Research Analyst
Your job: Find real market data, real trends, real competitor insights.
Do not guess. Use the search results provided.
Extract: what's selling, why it sells, who buys it, what price they pay.
Think like someone who has studied this market for years.`,
    version: 2,
    is_active: true,
    updated_at: "2025-03-18T14:00:00Z",
  },
  {
    id: "p-role-copywriter",
    layer: "role",
    target_id: "copywriter",
    name: "Copywriter Role",
    prompt: `Your role: Elite Direct Response Copywriter
Your job: Write copy that makes people pull out their wallet.
Use psychological triggers: social proof, scarcity, identity, transformation.
Avoid cliches, avoid fluff, avoid anything that sounds like it was AI-generated.
Every sentence must either build desire or eliminate doubt.`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-role-seo",
    layer: "role",
    target_id: "seo",
    name: "SEO Strategist Role",
    prompt: `Your role: Platform SEO Specialist
Your job: Maximize organic discoverability within platform constraints.
You understand: keyword intent, search behavior, platform algorithm signals.
Never sacrifice readability for keywords. Best SEO reads like natural language.`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-role-reviewer",
    layer: "role",
    target_id: "reviewer",
    name: "Reviewer / CEO Role",
    prompt: `Your role: Chief Quality Officer
Your job: Be the harshest, most demanding reviewer of this output.
Evaluate from 3 angles: (1) Would this sell? (2) Is the SEO strong? (3) Does it sound human?
Identify every weakness. Be specific about what needs to change.
Output a structured review with pass/fail per criterion and specific revision instructions.`,
    version: 2,
    is_active: true,
    updated_at: "2025-03-16T12:00:00Z",
  },
  {
    id: "p-role-designer",
    layer: "role",
    target_id: "designer",
    name: "Designer Role",
    prompt: `Your role: Senior Visual Designer
Your job: Create designs that communicate instantly and look professional.
Think about contrast, hierarchy, whitespace, and readability at all sizes.
Designs must work at thumbnail size on mobile AND full size on desktop/print.`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-role-coder",
    layer: "role",
    target_id: "coder",
    name: "Coder Role",
    prompt: `Your role: Senior Full-Stack Developer
Your job: Write clean, production-ready code with proper architecture.
Follow best practices: type safety, error handling, separation of concerns.
Prefer simple, maintainable solutions over clever abstractions.`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-domain-digital",
    layer: "domain",
    target_id: "digital-products",
    name: "Digital Products",
    prompt: `Domain context: Digital Products (instant download)
Key facts:
- Buyers want transformation, not information — sell the outcome not the content
- No physical shipping — speed and instant access are key selling points
- Screenshots and previews convert. Describe the product visually in text.
- Most successful digital products solve ONE specific problem for ONE specific person
- Gumroad and Etsy are primary channels. SEO must target "template" + "niche" keywords.`,
    version: 2,
    is_active: true,
    updated_at: "2025-03-15T10:00:00Z",
  },
  {
    id: "p-domain-pod",
    layer: "domain",
    target_id: "pod",
    name: "Print on Demand (POD)",
    prompt: `Domain context: Print-on-Demand (POD)
Key facts:
- Buyers purchase for identity expression, gifting, and community belonging
- Design must work at small scale (thumbnail on mobile) and large scale (actual print)
- Most successful POD niches are hyper-specific identity groups, not generic audiences
- Price competition is real — differentiation must come from niche specificity and design quality
- Etsy and Redbubble are the primary discovery channels — optimize for both`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-category-notion",
    layer: "category",
    target_id: "notion-templates",
    name: "Notion Templates",
    prompt: `Category: Notion Templates
Specific rules:
- Buyers are productivity-obsessed. Language: "system", "workflow", "organized", "automated"
- Always mention: mobile-friendly, free Notion account required, instant duplicate
- Best performers: CRM, project manager, content calendar, habit tracker, finance tracker
- Price range that converts: $7-$27 for single templates, $37-$97 for systems/bundles
- Keywords that drive traffic: "notion template", "notion dashboard", "notion system", "[niche] notion"`,
    version: 2,
    is_active: true,
    updated_at: "2025-03-14T09:00:00Z",
  },
  {
    id: "p-category-tshirts",
    layer: "category",
    target_id: "t-shirts",
    name: "T-Shirts & Apparel",
    prompt: `Category: POD T-Shirts & Apparel
Specific rules:
- Design must work in both light and dark shirt colors unless you specify one
- Text-based designs outperform complex illustrations on Etsy
- Hyper-niche identity phrases outperform generic funny quotes
- Size guide mention in description increases conversions
- Unisex positioning expands audience. Specify: "Unisex, true to size, soft cotton blend"
- Winning formula: [Identity group] + [Relatable situation or pride statement]`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-platform-etsy",
    layer: "platform",
    target_id: "etsy",
    name: "Etsy",
    prompt: `Platform: Etsy
Audience: Handmade lovers, gift shoppers, small business owners
Tone: Warm, personal, gift-focused, emotional
Title limit: 140 characters
Tags: 13 tags, max 20 chars each
SEO style: Long-tail, buyer-intent keywords
Description style: Story-driven, include: who it's for, what they get, how it helps
CTA style: Save for later, Perfect gift for...
Forbidden words: "best", "cheapest", "guaranteed"`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-platform-gumroad",
    layer: "platform",
    target_id: "gumroad",
    name: "Gumroad",
    prompt: `Platform: Gumroad
Audience: Creators, solopreneurs, freelancers
Tone: Value-driven, outcome-focused, creator-to-creator
Title limit: 100 characters
Tags: 10 tags
SEO style: Problem -> solution keywords
Description style: What you get + what problem it solves + who it's for
CTA style: Download instantly, Start using today`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-social-instagram",
    layer: "social",
    target_id: "instagram",
    name: "Instagram",
    prompt: `Channel: Instagram
Caption max: 2200 characters
Hashtags: up to 30
Tone: Visual, aspirational, lifestyle-focused
Format: Hook line -> value -> CTA -> hashtags
Content types: single image, carousel, reel script`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-social-tiktok",
    layer: "social",
    target_id: "tiktok",
    name: "TikTok",
    prompt: `Channel: TikTok
Hook max: 150 characters
Tone: Fast, punchy, entertaining, trend-aware
Format: Strong hook (1-3 seconds) -> problem -> solution -> CTA
Content types: video script, hook + 3 points + CTA`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-social-pinterest",
    layer: "social",
    target_id: "pinterest",
    name: "Pinterest",
    prompt: `Channel: Pinterest
Title max: 100 characters
Description max: 500 characters
Tone: Inspirational, search-optimized, idea-focused
Format: Keyword-rich title -> what it is -> who it's for -> link
Content types: pin title + description`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-context",
    layer: "context",
    target_id: null,
    name: "Context Injection Template",
    prompt: `Previous context from this workflow:
- Research findings: {step_1_research_output}
- Strategy decisions: {step_2_strategy_output}
- Similar products from cache: {cached_similar_products}
- Revision feedback (if revision): {ceo_feedback}

Use this context to:
1. Build on research findings, don't contradict them
2. Follow strategy decisions made earlier
3. Learn from similar products that performed well
4. Address ALL revision feedback points specifically`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-review-ceo",
    layer: "review",
    target_id: null,
    name: "CEO Review Prompt",
    prompt: `You are the CEO reviewing a product package before it goes to market.

Be extremely critical. Your standard: would YOU personally buy this? Would you be embarrassed by this?

Review the following output and score each criterion 1-10:

PRODUCT PACKAGE TO REVIEW:
{product_output_json}

Evaluate:
1. TITLE STRENGTH (1-10): Is it attention-grabbing? SEO-optimized? Platform-appropriate?
2. DESCRIPTION QUALITY (1-10): Does it sell? Is it human? Does it answer buyer questions?
3. SEO QUALITY (1-10): Right keywords? Right density? Platform-appropriate?
4. PRICE LOGIC (1-10): Competitive? Justified? Psychologically optimized?
5. PLATFORM FIT (1-10): Does it match the platform's buyer psychology?
6. HUMAN QUALITY (1-10): Does any part sound AI-generated or robotic?
7. OVERALL READINESS (1-10): Is this ready to publish?

For any score below 8:
- State exactly what is wrong
- State exactly what should be changed
- Provide the corrected version

Output format:
{
  "overall_score": number,
  "approved": boolean,
  "scores": { ... },
  "issues": [ { "criterion": "...", "problem": "...", "fix": "..." } ],
  "revised_sections": { ... }
}`,
    version: 3,
    is_active: true,
    updated_at: "2025-03-19T15:00:00Z",
  },
];

export const MOCK_VERSIONS: Record<string, PromptVersion[]> = {
  "p-master": [
    { id: "pv-1", prompt_id: "p-master", version: 3, prompt: MOCK_PROMPTS[0].prompt, updated_at: "2025-03-20T10:00:00Z" },
    { id: "pv-2", prompt_id: "p-master", version: 2, prompt: "You are NEXUS — a world-class AI business engine.\n\nCore rules:\n1. Never produce generic output.\n2. Think about the END BUYER.\n3. Optimize for platform algorithms.\n4. Produce output in JSON schema.\n5. Quality over speed.", updated_at: "2025-03-15T10:00:00Z" },
    { id: "pv-3", prompt_id: "p-master", version: 1, prompt: "You are NEXUS. Follow instructions carefully. Output JSON.", updated_at: "2025-03-10T08:00:00Z" },
  ],
};

// ─── Analytics ────────────────────────────────────────────────────────

export const MOCK_SUMMARY: AnalyticsSummary = {
  total_products_all_time: 47,
  total_products_this_month: 12,
  total_ai_calls_all_time: 423,
  total_ai_calls_this_month: 108,
  cache_hit_rate: 34.2,
  total_cost: 0.0,
  avg_workflow_time_ms: 45200,
  cost_savings: 12.85,
};

export const MOCK_AI_USAGE: AIUsageOverTime[] = [
  { date: "Mar 1", provider: "DeepSeek", tokens: 12400 },
  { date: "Mar 1", provider: "Qwen", tokens: 8200 },
  { date: "Mar 1", provider: "Workers AI", tokens: 3100 },
  { date: "Mar 8", provider: "DeepSeek", tokens: 15600 },
  { date: "Mar 8", provider: "Qwen", tokens: 6800 },
  { date: "Mar 8", provider: "Workers AI", tokens: 4500 },
  { date: "Mar 8", provider: "Groq", tokens: 2100 },
  { date: "Mar 15", provider: "DeepSeek", tokens: 18200 },
  { date: "Mar 15", provider: "Qwen", tokens: 9400 },
  { date: "Mar 15", provider: "Workers AI", tokens: 5200 },
  { date: "Mar 15", provider: "Groq", tokens: 3800 },
  { date: "Mar 22", provider: "DeepSeek", tokens: 14100 },
  { date: "Mar 22", provider: "Qwen", tokens: 7600 },
  { date: "Mar 22", provider: "Workers AI", tokens: 6100 },
];

export const MOCK_COST_BREAKDOWN: CostBreakdownItem[] = [
  { provider: "DeepSeek", cost: 0.0 },
  { provider: "Qwen", cost: 0.0 },
  { provider: "Workers AI", cost: 0.0 },
  { provider: "Groq", cost: 0.0 },
];

export const MOCK_CACHE_TREND: CacheHitTrendItem[] = [
  { date: "Mar 1", hit_rate: 18.5 },
  { date: "Mar 5", hit_rate: 22.3 },
  { date: "Mar 10", hit_rate: 28.7 },
  { date: "Mar 15", hit_rate: 31.4 },
  { date: "Mar 20", hit_rate: 34.2 },
  { date: "Mar 25", hit_rate: 36.8 },
];

export const MOCK_BY_DOMAIN: DomainBreakdownItem[] = [
  { domain: "Digital Products", count: 18 },
  { domain: "POD", count: 12 },
  { domain: "Content & Media", count: 8 },
  { domain: "Freelance", count: 5 },
  { domain: "Affiliate", count: 4 },
];

export const MOCK_BY_CATEGORY: CategoryBreakdownItem[] = [
  { category: "Notion Templates", count: 10 },
  { category: "T-Shirts & Apparel", count: 8 },
  { category: "PDF Guides", count: 6 },
  { category: "Podcast Content", count: 5 },
  { category: "Prompt Libraries", count: 4 },
  { category: "Planners", count: 3 },
  { category: "Courses", count: 3 },
];

export const MOCK_LEADERBOARD: AILeaderboardEntry[] = [
  { id: "m1", name: "DeepSeek-R1", provider: "DeepSeek", health_score: 97, avg_latency_ms: 1240, total_calls: 189, total_failures: 3 },
  { id: "m2", name: "Qwen-Plus", provider: "Qwen", health_score: 94, avg_latency_ms: 980, total_calls: 142, total_failures: 5 },
  { id: "m3", name: "Llama 3.1 8B", provider: "Workers AI", health_score: 100, avg_latency_ms: 420, total_calls: 58, total_failures: 0 },
  { id: "m4", name: "Mixtral 8x7B", provider: "Groq", health_score: 88, avg_latency_ms: 310, total_calls: 34, total_failures: 4 },
  { id: "m5", name: "Gemma 2 9B", provider: "Fireworks", health_score: 82, avg_latency_ms: 1560, total_calls: 22, total_failures: 4 },
];

/** Combined analytics dashboard mock (5.4) */
export const MOCK_DASHBOARD: AnalyticsDashboard = {
  summary: MOCK_SUMMARY,
  aiUsage: MOCK_AI_USAGE,
  costBreakdown: MOCK_COST_BREAKDOWN,
  cacheHitTrend: MOCK_CACHE_TREND,
  productsByDomain: MOCK_BY_DOMAIN,
  productsByCategory: MOCK_BY_CATEGORY,
  leaderboard: MOCK_LEADERBOARD,
};

// ─── Settings ────────────────────────────────────────────────────────

export const ALL_API_KEYS: { key_name: string; display_name: string }[] = [
  { key_name: "DEEPSEEK_API_KEY", display_name: "DeepSeek" },
  { key_name: "DASHSCOPE_API_KEY", display_name: "DashScope (Qwen)" },
  { key_name: "SILICONFLOW_API_KEY", display_name: "SiliconFlow" },
  { key_name: "GROQ_API_KEY", display_name: "Groq" },
  { key_name: "FIREWORKS_API_KEY", display_name: "Fireworks AI" },
  { key_name: "OPENROUTER_API_KEY", display_name: "OpenRouter" },
  { key_name: "HF_TOKEN", display_name: "Hugging Face" },
  { key_name: "TAVILY_API_KEY", display_name: "Tavily (Research)" },
  { key_name: "EXA_API_KEY", display_name: "Exa (Research)" },
  { key_name: "SERPAPI_KEY", display_name: "SerpAPI (Research)" },
  { key_name: "FAL_API_KEY", display_name: "fal.ai (FLUX Images)" },
  { key_name: "SUNO_API_KEY", display_name: "Suno (Audio)" },
  { key_name: "MOONSHOT_API_KEY", display_name: "Moonshot (Kimi)" },
  { key_name: "DATAFORSEO_KEY", display_name: "DataForSEO" },
  { key_name: "PRINTFUL_API_KEY", display_name: "Printful (Mockups)" },
  { key_name: "PRINTIFY_API_KEY", display_name: "Printify (Mockups)" },
  { key_name: "ANTHROPIC_API_KEY", display_name: "Anthropic (Claude)" },
  { key_name: "OPENAI_API_KEY", display_name: "OpenAI (GPT)" },
  { key_name: "GOOGLE_API_KEY", display_name: "Google (Gemini)" },
  { key_name: "MIDJOURNEY_API_KEY", display_name: "Midjourney" },
  { key_name: "IDEOGRAM_API_KEY", display_name: "Ideogram" },
  { key_name: "ELEVENLABS_API_KEY", display_name: "ElevenLabs (Voice)" },
  { key_name: "CARTESIA_API_KEY", display_name: "Cartesia (TTS)" },
  { key_name: "PERPLEXITY_API_KEY", display_name: "Perplexity (Research)" },
  { key_name: "PLACEIT_API_KEY", display_name: "Placeit (Mockups)" },
];

export const MOCK_API_KEYS: APIKeyEntry[] = ALL_API_KEYS.map((k) => ({
  ...k,
  status: ["DEEPSEEK_API_KEY", "GROQ_API_KEY", "TAVILY_API_KEY"].includes(k.key_name)
    ? ("active" as const)
    : ("not_set" as const),
}));

// ─── Platforms ────────────────────────────────────────────────────────

export const MOCK_PLATFORMS: PlatformFull[] = [
  {
    id: "plat-etsy",
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
    forbidden_words: "best, cheapest, guaranteed",
    is_active: true,
  },
  {
    id: "plat-gumroad",
    name: "Gumroad",
    slug: "gumroad",
    title_max_chars: 100,
    tag_count: 10,
    tag_max_chars: null,
    audience: "Creators, solopreneurs, freelancers",
    tone: "Value-driven, outcome-focused, creator-to-creator",
    seo_style: "Problem -> solution keywords",
    description_style: "What you get + what problem it solves + who it's for",
    cta_style: "Download instantly, Start using today",
    forbidden_words: "",
    is_active: true,
  },
  {
    id: "plat-shopify",
    name: "Shopify",
    slug: "shopify",
    title_max_chars: 70,
    tag_count: null,
    tag_max_chars: null,
    audience: "Brand-conscious buyers, direct traffic",
    tone: "Clean, brand-driven, professional",
    seo_style: "Short-tail + brand keywords",
    description_style: "Benefits-first, scannable bullets, trust signals",
    cta_style: "",
    forbidden_words: "",
    is_active: true,
  },
  {
    id: "plat-redbubble",
    name: "Redbubble",
    slug: "redbubble",
    title_max_chars: 60,
    tag_count: 15,
    tag_max_chars: null,
    audience: "Design lovers, pop culture fans, gift buyers",
    tone: "Fun, creative, trend-driven",
    seo_style: "",
    description_style: "Design-first, playful, trendy language",
    cta_style: "",
    forbidden_words: "",
    is_active: true,
  },
  {
    id: "plat-amazon-kdp",
    name: "Amazon KDP",
    slug: "amazon-kdp",
    title_max_chars: 200,
    tag_count: null,
    tag_max_chars: null,
    audience: "Readers, learners, professional development seekers",
    tone: "Authority-driven, educational, trustworthy",
    seo_style: "",
    description_style: "Book-style blurb, author authority, what reader will learn",
    cta_style: "",
    forbidden_words: "",
    is_active: false,
  },
];

// ─── Social Channels ─────────────────────────────────────────────────

export const MOCK_CHANNELS: SocialChannelFull[] = [
  {
    id: "social-instagram",
    name: "Instagram",
    slug: "instagram",
    caption_max_chars: 2200,
    hashtag_count: 30,
    tone: "Visual, aspirational, lifestyle-focused",
    format: "Hook line -> value -> CTA -> hashtags",
    content_types: ["single image", "carousel", "reel script"],
    is_active: true,
  },
  {
    id: "social-tiktok",
    name: "TikTok",
    slug: "tiktok",
    caption_max_chars: 150,
    hashtag_count: null,
    tone: "Fast, punchy, entertaining, trend-aware",
    format: "Strong hook (1-3 seconds) -> problem -> solution -> CTA",
    content_types: ["video script", "hook + 3 points + CTA"],
    is_active: true,
  },
  {
    id: "social-pinterest",
    name: "Pinterest",
    slug: "pinterest",
    caption_max_chars: 500,
    hashtag_count: 20,
    tone: "Inspirational, aspirational, search-optimized",
    format: "Keyword-rich title -> benefit description -> link CTA",
    content_types: ["pin description", "idea pin script"],
    is_active: true,
  },
  {
    id: "social-linkedin",
    name: "LinkedIn",
    slug: "linkedin",
    caption_max_chars: 3000,
    hashtag_count: 5,
    tone: "Professional, thought-leadership, value-first",
    format: "Bold hook -> insight -> personal take -> CTA",
    content_types: ["text post", "document carousel", "article"],
    is_active: true,
  },
  {
    id: "social-x",
    name: "X / Twitter",
    slug: "x-twitter",
    caption_max_chars: 280,
    hashtag_count: 3,
    tone: "Sharp, witty, conversational",
    format: "Hot take or hook -> thread (if needed) -> CTA + link",
    content_types: ["tweet", "thread"],
    is_active: false,
  },
];
