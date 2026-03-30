-- ============================================================
-- NEXUS V4: Analytics Table + All Seed Data
-- Cloudflare D1 (SQLite dialect)
-- ============================================================

-- Analytics / event tracking table
CREATE TABLE analytics (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  product_id    TEXT,
  run_id        TEXT,
  ai_model      TEXT,
  tokens_used   INTEGER,
  cost          REAL DEFAULT 0,
  latency_ms    INTEGER,
  cached        BOOLEAN DEFAULT false,
  metadata      JSON,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Analytics indexes
CREATE INDEX idx_analytics_event_type ON analytics(event_type);
CREATE INDEX idx_analytics_product_id ON analytics(product_id);
CREATE INDEX idx_analytics_created_at ON analytics(created_at);
CREATE INDEX idx_analytics_ai_model ON analytics(ai_model);

-- ============================================================
-- SEED DATA: Default Domains (Part 3)
-- ============================================================

INSERT OR IGNORE INTO domains (id, name, slug, icon, sort_order, is_active) VALUES
  ('dom_digital_products',    'Digital Products',         'digital-products',       '📦', 1,  true),
  ('dom_pod',                 'Print on Demand (POD)',    'print-on-demand',        '👕', 2,  true),
  ('dom_content_media',       'Content & Media',          'content-media',          '🎬', 3,  true),
  ('dom_freelance',           'Freelance Services',       'freelance-services',     '💼', 4,  true),
  ('dom_affiliate',           'Affiliate Marketing',      'affiliate-marketing',    '🔗', 5,  true),
  ('dom_ecommerce',           'E-Commerce & Retail',      'e-commerce-retail',      '🛒', 6,  true),
  ('dom_education',           'Knowledge & Education',    'knowledge-education',    '📚', 7,  true),
  ('dom_tech',                'Specialized Technology',   'specialized-technology', '🔬', 8,  true),
  ('dom_automation',          'Automation & No-Code',     'automation-no-code',     '⚙️', 9,  true),
  ('dom_space',               'Space & Innovation',       'space-innovation',       '🚀', 10, true);

-- ============================================================
-- SEED DATA: Categories per Domain (Part 3)
-- ============================================================

-- Domain 1: Digital Products
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_notion_templates',       'dom_digital_products', 'Notion Templates',              'notion-templates',              1,  true),
  ('cat_pdf_guides',             'dom_digital_products', 'PDF Guides & Ebooks',           'pdf-guides-ebooks',             2,  true),
  ('cat_planners',               'dom_digital_products', 'Planners & Calendars',          'planners-calendars',            3,  true),
  ('cat_courses',                'dom_digital_products', 'Courses & E-Learning Modules',  'courses-e-learning-modules',    4,  true),
  ('cat_prompt_libraries',       'dom_digital_products', 'Prompt Libraries',              'prompt-libraries',              5,  true),
  ('cat_saas_templates',         'dom_digital_products', 'SaaS Templates',                'saas-templates',                6,  true),
  ('cat_checklists',             'dom_digital_products', 'Checklists & Trackers',         'checklists-trackers',           7,  true),
  ('cat_spreadsheets',           'dom_digital_products', 'Spreadsheet Templates',         'spreadsheet-templates',         8,  true),
  ('cat_ai_toolkits',            'dom_digital_products', 'AI Tool Kits',                  'ai-tool-kits',                  9,  true),
  ('cat_storybooks',             'dom_digital_products', 'Storybooks & Kids Books',       'storybooks-kids-books',         10, true);

-- Domain 2: Print on Demand (POD)
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_tshirts',                'dom_pod', 'T-Shirts & Apparel',        't-shirts-apparel',        1,  true),
  ('cat_mugs',                   'dom_pod', 'Mugs & Drinkware',          'mugs-drinkware',          2,  true),
  ('cat_posters',                'dom_pod', 'Posters & Wall Art',        'posters-wall-art',        3,  true),
  ('cat_phone_cases',            'dom_pod', 'Phone Cases',               'phone-cases',             4,  true),
  ('cat_tote_bags',              'dom_pod', 'Tote Bags',                 'tote-bags',               5,  true),
  ('cat_stickers',               'dom_pod', 'Stickers & Decals',         'stickers-decals',         6,  true),
  ('cat_hoodies',                'dom_pod', 'Hoodies & Sweatshirts',     'hoodies-sweatshirts',     7,  true),
  ('cat_home_decor',             'dom_pod', 'Home Decor',                'home-decor',              8,  true),
  ('cat_notebooks',              'dom_pod', 'Notebooks & Journals',      'notebooks-journals',      9,  true),
  ('cat_hats',                   'dom_pod', 'Hats & Accessories',        'hats-accessories',        10, true);

-- Domain 3: Content & Media
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_video_making',           'dom_content_media', 'Video Making (Scripts, Shorts, YouTube)', 'video-making',            1, true),
  ('cat_music_making',           'dom_content_media', 'Music Making (Loops, Intros, Sonic Logos)', 'music-making',          2, true),
  ('cat_podcast',                'dom_content_media', 'Podcast Content (Episodes, Show Notes)',  'podcast-content',         3, true),
  ('cat_animation',              'dom_content_media', 'Animation Scripts',                       'animation-scripts',      4, true),
  ('cat_stock_photo',            'dom_content_media', 'Stock Photography Concepts',              'stock-photography',      5, true),
  ('cat_3d_assets',              'dom_content_media', '3D Asset Descriptions',                   '3d-asset-descriptions',  6, true),
  ('cat_broll',                  'dom_content_media', 'B-roll Organization',                     'b-roll-organization',    7, true),
  ('cat_visual_packs',           'dom_content_media', 'Visual Asset Packs',                      'visual-asset-packs',     8, true);

-- Domain 4: Freelance Services
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_software_dev',           'dom_freelance', 'Software Development (Web, SaaS, API)',       'software-development',    1, true),
  ('cat_tech_writing',           'dom_freelance', 'Technical Writing (Docs, White Papers)',       'technical-writing',       2, true),
  ('cat_seo_marketing',          'dom_freelance', 'SEO & Digital Marketing Audits',               'seo-digital-marketing',   3, true),
  ('cat_legal',                  'dom_freelance', 'Legal & Compliance (Contracts, Policies)',      'legal-compliance',        4, true),
  ('cat_business_ops',           'dom_freelance', 'Business Operations (SOPs, Workflows)',        'business-operations',     5, true),
  ('cat_uiux',                   'dom_freelance', 'UI/UX Design Briefs',                          'uiux-design-briefs',      6, true),
  ('cat_db_architecture',        'dom_freelance', 'Database Architecture',                        'database-architecture',   7, true),
  ('cat_mobile_dev',             'dom_freelance', 'Mobile App Development',                       'mobile-app-development',  8, true);

-- Domain 5: Affiliate Marketing
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_software_comparison',    'dom_affiliate', 'Software Comparison Articles',   'software-comparison',     1, true),
  ('cat_product_reviews',        'dom_affiliate', 'Product Review Posts',           'product-review-posts',    2, true),
  ('cat_top10',                  'dom_affiliate', 'Top 10 Roundups',               'top-10-roundups',         3, true),
  ('cat_buying_guides',          'dom_affiliate', 'Buying Guides',                 'buying-guides',           4, true),
  ('cat_deal_newsletters',       'dom_affiliate', 'Deal & Discount Newsletters',   'deal-discount-newsletters', 5, true),
  ('cat_niche_blogs',            'dom_affiliate', 'Niche Blog Posts',              'niche-blog-posts',        6, true),
  ('cat_yt_reviews',             'dom_affiliate', 'YouTube Script Reviews',        'youtube-script-reviews',  7, true),
  ('cat_email_sequences',        'dom_affiliate', 'Email Sequences',              'email-sequences',         8, true);

-- Domain 6: E-Commerce & Retail
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_dropshipping',           'dom_ecommerce', 'Dropshipping Product Research',   'dropshipping-research',      1, true),
  ('cat_amazon_fba',             'dom_ecommerce', 'Amazon FBA Listings',             'amazon-fba-listings',        2, true),
  ('cat_shopify_setup',          'dom_ecommerce', 'Shopify Store Setup',             'shopify-store-setup',        3, true),
  ('cat_inventory',              'dom_ecommerce', 'Inventory Management SOPs',       'inventory-management',       4, true),
  ('cat_marketplace_opt',        'dom_ecommerce', 'Marketplace Optimization',        'marketplace-optimization',   5, true),
  ('cat_bundles',                'dom_ecommerce', 'Product Bundle Creation',         'product-bundle-creation',    6, true),
  ('cat_supplier',               'dom_ecommerce', 'Supplier Research',               'supplier-research',          7, true);

-- Domain 7: Knowledge & Education
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_online_courses',         'dom_education', 'Online Course Creation',           'online-course-creation',      1, true),
  ('cat_workshop',               'dom_education', 'Workshop Materials',               'workshop-materials',          2, true),
  ('cat_paid_newsletter',        'dom_education', 'Paid Newsletter Content',          'paid-newsletter-content',     3, true),
  ('cat_certification',          'dom_education', 'Skill Certification Modules',      'skill-certification',         4, true),
  ('cat_coaching',               'dom_education', 'Coaching Plans (Fitness, Finance)', 'coaching-plans',             5, true),
  ('cat_study_guides',           'dom_education', 'Study Guides',                     'study-guides',                6, true),
  ('cat_training_manuals',       'dom_education', 'Training Manuals',                 'training-manuals',            7, true);

-- Domain 8: Specialized Technology
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_ai_implementation',      'dom_tech', 'AI Implementation Plans',           'ai-implementation-plans',     1, true),
  ('cat_cybersecurity',          'dom_tech', 'Cybersecurity Audit Reports',       'cybersecurity-audit-reports', 2, true),
  ('cat_real_estate',            'dom_tech', 'Real Estate Listing Automation',    'real-estate-automation',      3, true),
  ('cat_healthtech',             'dom_tech', 'HealthTech Wellness Content',       'healthtech-wellness',         4, true),
  ('cat_nocode_builds',          'dom_tech', 'No-Code Tool Builds',              'no-code-tool-builds',         5, true),
  ('cat_proptech',               'dom_tech', 'PropTech Lead Systems',            'proptech-lead-systems',       6, true);

-- Domain 9: Automation & No-Code
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_zapier_make',            'dom_automation', 'Zapier/Make Workflow Designs',     'zapier-make-workflows',       1, true),
  ('cat_n8n',                    'dom_automation', 'n8n Automation Blueprints',        'n8n-automation-blueprints',   2, true),
  ('cat_airtable_notion',        'dom_automation', 'Airtable/Notion System Builds',   'airtable-notion-systems',     3, true),
  ('cat_api_docs',               'dom_automation', 'API Integration Docs',            'api-integration-docs',        4, true),
  ('cat_chatbot',                'dom_automation', 'Chatbot Flow Design',             'chatbot-flow-design',         5, true),
  ('cat_crm',                    'dom_automation', 'CRM Automation Plans',            'crm-automation-plans',        6, true);

-- Domain 10: Space & Innovation
INSERT OR IGNORE INTO categories (id, domain_id, name, slug, sort_order, is_active) VALUES
  ('cat_space_tourism',          'dom_space', 'Space Tourism Content',        'space-tourism-content',       1, true),
  ('cat_satellite',              'dom_space', 'Satellite Data Reports',       'satellite-data-reports',      2, true),
  ('cat_space_merch',            'dom_space', 'Space Merchandise Concepts',   'space-merchandise-concepts',  3, true),
  ('cat_aerospace',              'dom_space', 'Aerospace Research Briefs',    'aerospace-research-briefs',   4, true);

-- ============================================================
-- SEED DATA: Default Platforms (Part 7)
-- ============================================================

INSERT OR IGNORE INTO platforms (id, name, slug, title_max_chars, tag_count, tag_max_chars, audience, tone, seo_style, description_style, cta_style, rules_json, is_active) VALUES
  ('plat_etsy', 'Etsy', 'etsy', 140, 13, 20,
   'Handmade lovers, gift shoppers, small business owners',
   'Warm, personal, gift-focused, emotional',
   'Long-tail, buyer-intent keywords',
   'Story-driven, include: who it''s for, what they get, how it helps',
   'Save for later, Perfect gift for...',
   '{"forbidden":["best","cheapest","guaranteed"]}',
   true),

  ('plat_gumroad', 'Gumroad', 'gumroad', 100, 10, NULL,
   'Creators, solopreneurs, freelancers',
   'Value-driven, outcome-focused, creator-to-creator',
   'Problem -> solution keywords',
   'What you get + what problem it solves + who it''s for',
   'Download instantly, Start using today',
   NULL,
   true),

  ('plat_shopify', 'Shopify', 'shopify', 70, NULL, NULL,
   'Brand-conscious buyers, direct traffic',
   'Clean, brand-driven, professional',
   'Short-tail + brand keywords',
   'Benefits-first, scannable bullets, trust signals',
   NULL,
   NULL,
   true),

  ('plat_redbubble', 'Redbubble', 'redbubble', 60, 15, NULL,
   'Design lovers, pop culture fans, gift buyers',
   'Fun, creative, trend-driven',
   'Trend-driven, design-focused keywords',
   'Design-first, playful, trendy language',
   NULL,
   NULL,
   true),

  ('plat_amazon_kdp', 'Amazon KDP', 'amazon_kdp', 200, NULL, NULL,
   'Readers, learners, professional development seekers',
   'Authority-driven, educational, trustworthy',
   'Category-specific, high-volume keywords',
   'Book-style blurb, author authority, what reader will learn',
   NULL,
   NULL,
   true);

-- ============================================================
-- SEED DATA: Default Social Channels (Part 8)
-- ============================================================

INSERT OR IGNORE INTO social_channels (id, name, slug, caption_max_chars, hashtag_count, tone, format, content_types, is_active) VALUES
  ('soc_instagram', 'Instagram', 'instagram', 2200, 30,
   'Visual, aspirational, lifestyle-focused',
   'Hook line -> value -> CTA -> hashtags',
   '["single image","carousel","reel script"]',
   true),

  ('soc_tiktok', 'TikTok', 'tiktok', 150, NULL,
   'Fast, punchy, entertaining, trend-aware',
   'Strong hook (1-3 seconds) -> problem -> solution -> CTA',
   '["video script","hook + 3 points + CTA"]',
   true),

  ('soc_pinterest', 'Pinterest', 'pinterest', 500, NULL,
   'Inspirational, search-optimized, idea-focused',
   'Keyword-rich title -> what it is -> who it''s for -> link',
   '["pin title + description"]',
   true),

  ('soc_linkedin', 'LinkedIn', 'linkedin', 3000, NULL,
   'Professional, insight-driven, authority-building',
   'Bold opening statement -> 3-5 insights -> professional CTA',
   '["article post","insight post"]',
   true),

  ('soc_x_twitter', 'X / Twitter', 'x_twitter', 280, NULL,
   'Direct, witty, value-dense, conversation-starting',
   'Hook tweet -> 5-7 value tweets -> CTA tweet',
   '["single tweet","thread"]',
   true);

-- ============================================================
-- SEED DATA: Default Settings
-- ============================================================

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('social_posting_mode', 'manual'),
  ('default_language', 'en'),
  ('ceo_review_required', 'true'),
  ('auto_publish_after_approval', 'false'),
  ('batch_max_products', '10'),
  ('cache_enabled', 'true'),
  ('ai_gateway_enabled', 'true');

-- ============================================================
-- SEED DATA: AI Models (Part 6)
-- ============================================================

-- Research: Web Trend Research
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_tavily',            'Tavily Search',          'tavily.com',    'research', 1, 'TAVILY_API_KEY',       false, 'active', true,  'Purpose-built for AI agents. Returns clean structured web data.'),
  ('ai_exa',               'Exa Neural Search',      'exa.ai',        'research', 2, 'EXA_API_KEY',          false, 'active', true,  'Finds by meaning not keywords. Discovers emerging niches.'),
  ('ai_serpapi',            'SerpAPI',                'serpapi.com',   'research', 3, 'SERPAPI_KEY',          false, 'active', true,  'Raw Google results. Reliable backup for trend data.'),
  ('ai_deepseek_v3_res',    'DeepSeek-V3',            'deepseek.com',  'research', 4, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Reasoning fallback when search APIs hit limits.'),
  ('ai_workers_research',   'Workers AI (Llama 3.1)', 'Cloudflare',   'research', 5, NULL,                  true,  'active', true,  'Ultimate fallback. On-platform, always available.');

-- Research: Keyword & SEO Research
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_dataforseo',         'DataForSEO',             'dataforseo.com', 'seo',    1, 'DATAFORSEO_API_KEY',  false, 'active', true,  'Most accurate keyword volume + difficulty data.'),
  ('ai_serpapi_seo',         'SerpAPI',                'serpapi.com',    'seo',    2, 'SERPAPI_KEY',         false, 'active', true,  'See exactly what pages rank and why.'),
  ('ai_qwen_flash_seo',     'Qwen 3.5 Flash',        'SiliconFlow',   'seo',    3, 'SILICONFLOW_API_KEY', false, 'active', true,  'Cheapest reasoning fallback for keyword clustering.'),
  ('ai_workers_seo',         'Workers AI (Llama 3.1)', 'Cloudflare',   'seo',    4, NULL,                  true,  'active', true,  'Ultimate fallback for keyword analysis.');

-- Writing: Long-form Writing
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_deepseek_v3_write',  'DeepSeek-V3',            'deepseek.com',  'writing', 1, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Best free long-form quality. Avoids robotic patterns.'),
  ('ai_qwen_max_write',     'Qwen 3.5 Max',          'SiliconFlow',   'writing', 2, 'SILICONFLOW_API_KEY', false, 'active', true,  'Strong long-form. Especially good for technical topics.'),
  ('ai_doubao_pro_write',   'Doubao 1.5 Pro',         'SiliconFlow',   'writing', 3, 'SILICONFLOW_API_KEY', false, 'active', true,  'ByteDance model. Most human-like narrative flow.'),
  ('ai_kimi',               'Kimi k1.5',              'moonshot.cn',   'writing', 4, 'KIMI_API_KEY',        false, 'active', true,  '10M token context. Never loses track on long docs.'),
  ('ai_workers_writing',    'Workers AI (Llama 3.1)', 'Cloudflare',   'writing', 5, NULL,                  true,  'active', true,  'Emergency fallback. Shorter output but always works.'),
  ('ai_claude_write',       'Claude Sonnet 4.5',      'anthropic.com', 'writing', 6, 'ANTHROPIC_API_KEY',   false, 'sleeping', false, 'Best quality writing on the market.'),
  ('ai_gpt_write',          'GPT-5.4',                'openai.com',    'writing', 7, 'OPENAI_API_KEY',      false, 'sleeping', false, 'Top-tier long-form.');

-- SEO Formatting
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_qwen_flash_fmt',     'Qwen 3.5 Flash',        'SiliconFlow',   'seo',    5, 'SILICONFLOW_API_KEY', false, 'active', true,  'Fastest + best at constrained output.'),
  ('ai_deepseek_v3_seo',    'DeepSeek-V3',            'deepseek.com',  'seo',    6, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Reliable rule-following for SEO constraints.'),
  ('ai_mistral_seo',        'Mistral 7B',             'Groq',          'seo',    7, 'GROQ_API_KEY',        false, 'active', true,  'Ultra-fast free inference. Good SEO fallback.'),
  ('ai_llama_scout_seo',    'Llama 4 Scout',          'Fireworks AI',  'seo',    8, 'FIREWORKS_API_KEY',   false, 'active', true,  'Free tier. Strong structured output.'),
  ('ai_workers_seo2',       'Workers AI (Llama 3.1)', 'Cloudflare',   'seo',    9, NULL,                  true,  'active', true,  'Structured output fallback.');

-- Reasoning & Analysis
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_deepseek_r1',        'DeepSeek-R1',            'deepseek.com',  'review',  1, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Best free reasoning model.'),
  ('ai_qwen_max_reason',    'Qwen 3.5 Max',          'SiliconFlow',   'review',  2, 'SILICONFLOW_API_KEY', false, 'active', true,  'Strong analytical reasoning. Great fallback.'),
  ('ai_phi4',               'Phi-4',                  'HuggingFace',   'review',  3, 'HF_API_KEY',          false, 'active', true,  'Microsoft small model. Punches above weight on logic.'),
  ('ai_workers_review',     'Workers AI (Llama 3.1)', 'Cloudflare',   'review',  4, NULL,                  true,  'active', true,  'Basic reasoning fallback.'),
  ('ai_gemini_reason',      'Gemini 3.1 Pro',        'google.com',    'review',  5, 'GOOGLE_API_KEY',      false, 'sleeping', false, 'Best paid reasoning.'),
  ('ai_claude_reason',      'Claude Opus 4.6',       'anthropic.com', 'review',  6, 'ANTHROPIC_API_KEY',   false, 'sleeping', false, 'Deep nuanced thinking. Best for strategy.');

-- Code Generation
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_deepseek_coder',     'DeepSeek-Coder-V3',      'deepseek.com',  'code',    1, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Purpose-built for software architecture. Best free coder.'),
  ('ai_qwen_coder',         'Qwen 3.5 (Coder)',      'SiliconFlow',   'code',    2, 'SILICONFLOW_API_KEY', false, 'active', true,  'Strong full-stack. Next.js/Supabase/CF fluent.'),
  ('ai_deepseek_r1_code',   'DeepSeek-R1',            'deepseek.com',  'code',    3, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Complex algorithmic problems needing reasoning first.'),
  ('ai_workers_code',       'Workers AI (Llama 3.1)', 'Cloudflare',   'code',    4, NULL,                  true,  'active', true,  'Simple code generation fallback.'),
  ('ai_gpt_codex',          'GPT-5.3 Codex',         'openai.com',    'code',    5, 'OPENAI_API_KEY',      false, 'sleeping', false, 'Specialized purely for repository-scale coding.'),
  ('ai_claude_code',        'Claude Sonnet 4.5',      'anthropic.com', 'code',    6, 'ANTHROPIC_API_KEY',   false, 'sleeping', false, 'Best at understanding requirements -> clean code.');

-- Image: Text-on-Image Generation
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_flux_pro',           'FLUX.1 Pro',             'fal.ai',        'image',   1, 'FAL_API_KEY',         false, 'active', true,  'Best text rendering in images. POD essential.'),
  ('ai_ideogram',           'Ideogram 3.0',           'ideogram.ai',   'image',   2, 'IDEOGRAM_API_KEY',    false, 'active', true,  'Specialized in typography + graphic design layouts.'),
  ('ai_sdxl_hf',            'SDXL',                   'HuggingFace',   'image',   3, 'HF_API_KEY',          false, 'active', true,  'Free, open. Good for illustration-style designs.'),
  ('ai_segmind',            'Segmind',                'segmind.com',   'image',   4, 'SEGMIND_API_KEY',     false, 'active', true,  'Serverless SD endpoints. Fast fallback.'),
  ('ai_workers_image',      'Workers AI (SDXL)',      'Cloudflare',    'image',   5, NULL,                  true,  'active', true,  'On-platform image gen. Basic but free.'),
  ('ai_midjourney',         'Midjourney',             'PiAPI',         'image',   6, 'PIAPI_API_KEY',       false, 'sleeping', false, 'Highest artistic quality. Worth it for premium.'),
  ('ai_dalle3',             'DALL-E 3',               'openai.com',    'image',   7, 'OPENAI_API_KEY',      false, 'sleeping', false, 'Reliable, clean text rendering.');

-- Audio: Music Generation
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_suno',               'Suno',                   'suno.com',      'audio',   1, 'SUNO_API_KEY',        false, 'active', true,  'Best overall audio quality. All genres. 50 songs/day free.'),
  ('ai_udio',               'Udio',                   'udio.com',      'audio',   2, 'UDIO_API_KEY',        false, 'active', true,  'Different sonic character. Strong for specific genres.'),
  ('ai_musicgen',           'MusicGen',               'HuggingFace',   'audio',   3, 'HF_API_KEY',          false, 'active', true,  'Open source. Free. No limits. Good instrumentals.'),
  ('ai_stable_audio',       'Stable Audio',           'stability.ai',  'audio',   4, 'STABILITY_API_KEY',   false, 'active', true,  'Strong for sound design, stingers, ambience.'),
  ('ai_udio_pro',           'Udio Pro',               'udio.com',      'audio',   5, 'UDIO_API_KEY',        false, 'sleeping', false, 'Higher quality, longer generation.');

-- Platform Variation AI
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_qwen_flash_var',     'Qwen 3.5 Flash',        'SiliconFlow',   'variation', 1, 'SILICONFLOW_API_KEY', false, 'active', true,  'Fastest at rule-based rewriting tasks.'),
  ('ai_deepseek_v3_var',    'DeepSeek-V3',            'deepseek.com',  'variation', 2, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Better at maintaining quality while adapting tone.'),
  ('ai_doubao_lite_var',    'Doubao 1.5 Lite',        'SiliconFlow',   'variation', 3, 'SILICONFLOW_API_KEY', false, 'active', true,  'Micro-model. Perfect for fast variation generation.'),
  ('ai_workers_variation',  'Workers AI (Llama 3.1)', 'Cloudflare',   'variation', 4, NULL,                  true,  'active', true,  'Variation fallback.');

-- Social Media Adaptation
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_doubao_pro_soc',     'Doubao 1.5 Pro',         'SiliconFlow',   'social',  1, 'SILICONFLOW_API_KEY', false, 'active', true,  'ByteDance. Naturally understands social platform patterns.'),
  ('ai_deepseek_v3_soc',    'DeepSeek-V3',            'deepseek.com',  'social',  2, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Best at tone adaptation across platforms.'),
  ('ai_qwen_max_soc',       'Qwen 3.5 Max',          'SiliconFlow',   'social',  3, 'SILICONFLOW_API_KEY', false, 'active', true,  'Strong creative writing for social.'),
  ('ai_workers_social',     'Workers AI (Llama 3.1)', 'Cloudflare',   'social',  4, NULL,                  true,  'active', true,  'Social fallback.');

-- Humanizer AI
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_doubao_pro_hum',     'Doubao 1.5 Pro',         'SiliconFlow',   'humanizer', 1, 'SILICONFLOW_API_KEY', false, 'active', true,  'Most human-like conversational output.'),
  ('ai_deepseek_v3_hum',    'DeepSeek-V3',            'deepseek.com',  'humanizer', 2, 'DEEPSEEK_API_KEY',    false, 'active', true,  'Naturally avoids AI writing patterns.'),
  ('ai_minimax',            'MiniMax M2.5',           'minimax.io',    'humanizer', 3, 'MINIMAX_API_KEY',     false, 'active', true,  'Best human-like flow in industry.'),
  ('ai_workers_humanizer',  'Workers AI (Llama 3.1)', 'Cloudflare',   'humanizer', 4, NULL,                  true,  'active', true,  'Basic humanizer fallback.'),
  ('ai_claude_hum',         'Claude Sonnet 4.5',      'anthropic.com', 'humanizer', 5, 'ANTHROPIC_API_KEY',   false, 'sleeping', false, 'Lowest AI-detection score of any model.');

-- Final Quality Review
INSERT OR IGNORE INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, is_free_tier, notes) VALUES
  ('ai_deepseek_r1_rev',    'DeepSeek-R1',            'deepseek.com',  'review',  7,  'DEEPSEEK_API_KEY',    false, 'active', true,  'Reasoning model. Evaluates from multiple angles.'),
  ('ai_qwen_max_rev',       'Qwen 3.5 Max',          'SiliconFlow',   'review',  8,  'SILICONFLOW_API_KEY', false, 'active', true,  'Strong checklist-following and gap detection.'),
  ('ai_workers_review2',    'Workers AI (Llama 3.1)', 'Cloudflare',   'review',  9,  NULL,                  true,  'active', true,  'Basic review fallback.'),
  ('ai_claude_review',      'Claude Opus 4.6',       'anthropic.com', 'review',  10, 'ANTHROPIC_API_KEY',   false, 'sleeping', false, 'Most nuanced reviewer on the market.'),
  ('ai_gpt_review',         'GPT-5.4 High',          'openai.com',    'review',  11, 'OPENAI_API_KEY',      false, 'sleeping', false, 'PhD-level logic for final review.');
