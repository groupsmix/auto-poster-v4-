// Default domains data — used as fallback when API is not available

export interface DomainData {
  name: string;
  slug: string;
  icon: string;
}

export interface CategoryData {
  name: string;
  slug: string;
}

export const DEFAULT_DOMAINS: DomainData[] = [
  {
    name: "Digital Products",
    slug: "digital-products",
    icon: "\u{1F4E6}",
  },
  {
    name: "Print on Demand (POD)",
    slug: "print-on-demand",
    icon: "\u{1F455}",
  },
  {
    name: "Content & Media",
    slug: "content-media",
    icon: "\u{1F3AC}",
  },
  {
    name: "Freelance Services",
    slug: "freelance-services",
    icon: "\u{1F4BC}",
  },
  {
    name: "Affiliate Marketing",
    slug: "affiliate-marketing",
    icon: "\u{1F517}",
  },
  {
    name: "E-Commerce & Retail",
    slug: "e-commerce-retail",
    icon: "\u{1F6D2}",
  },
  {
    name: "Knowledge & Education",
    slug: "knowledge-education",
    icon: "\u{1F4DA}",
  },
  {
    name: "Specialized Technology",
    slug: "specialized-technology",
    icon: "\u{1F52C}",
  },
  {
    name: "Automation & No-Code",
    slug: "automation-no-code",
    icon: "\u2699\uFE0F",
  },
  {
    name: "Space & Innovation",
    slug: "space-innovation",
    icon: "\u{1F680}",
  },
];

// Default categories per domain — from NEXUS Architecture V4 Part 3
export const DEFAULT_CATEGORIES: Record<string, CategoryData[]> = {
  "digital-products": [
    { name: "Notion Templates", slug: "notion-templates" },
    { name: "PDF Guides & Ebooks", slug: "pdf-guides-ebooks" },
    { name: "Planners & Calendars", slug: "planners-calendars" },
    { name: "Courses & E-Learning Modules", slug: "courses-e-learning" },
    { name: "Prompt Libraries", slug: "prompt-libraries" },
    { name: "SaaS Templates", slug: "saas-templates" },
    { name: "Checklists & Trackers", slug: "checklists-trackers" },
    { name: "Spreadsheet Templates", slug: "spreadsheet-templates" },
    { name: "AI Tool Kits", slug: "ai-tool-kits" },
    { name: "Storybooks & Kids Books", slug: "storybooks-kids-books" },
  ],
  "print-on-demand": [
    { name: "T-Shirts & Apparel", slug: "t-shirts-apparel" },
    { name: "Mugs & Drinkware", slug: "mugs-drinkware" },
    { name: "Posters & Wall Art", slug: "posters-wall-art" },
    { name: "Phone Cases", slug: "phone-cases" },
    { name: "Tote Bags", slug: "tote-bags" },
    { name: "Stickers & Decals", slug: "stickers-decals" },
    { name: "Hoodies & Sweatshirts", slug: "hoodies-sweatshirts" },
    { name: "Home Decor", slug: "home-decor" },
    { name: "Notebooks & Journals", slug: "notebooks-journals" },
    { name: "Hats & Accessories", slug: "hats-accessories" },
  ],
  "content-media": [
    { name: "Video Making", slug: "video-making" },
    { name: "Music Making", slug: "music-making" },
    { name: "Podcast Content", slug: "podcast-content" },
    { name: "Animation Scripts", slug: "animation-scripts" },
    { name: "Stock Photography Concepts", slug: "stock-photography" },
    { name: "3D Asset Descriptions", slug: "3d-assets" },
    { name: "B-roll Organization", slug: "b-roll" },
    { name: "Visual Asset Packs", slug: "visual-asset-packs" },
  ],
  "freelance-services": [
    { name: "Software Development", slug: "software-development" },
    { name: "Technical Writing", slug: "technical-writing" },
    { name: "SEO & Digital Marketing Audits", slug: "seo-marketing" },
    { name: "Legal & Compliance", slug: "legal-compliance" },
    { name: "Business Operations", slug: "business-operations" },
    { name: "UI/UX Design Briefs", slug: "uiux-design" },
    { name: "Database Architecture", slug: "database-architecture" },
    { name: "Mobile App Development", slug: "mobile-app-dev" },
  ],
  "affiliate-marketing": [
    { name: "Software Comparison Articles", slug: "software-comparisons" },
    { name: "Product Review Posts", slug: "product-reviews" },
    { name: "Top 10 Roundups", slug: "top-10-roundups" },
    { name: "Buying Guides", slug: "buying-guides" },
    { name: "Deal & Discount Newsletters", slug: "deal-newsletters" },
    { name: "Niche Blog Posts", slug: "niche-blog-posts" },
    { name: "YouTube Script Reviews", slug: "youtube-scripts" },
    { name: "Email Sequences", slug: "email-sequences" },
  ],
  "e-commerce-retail": [
    { name: "Dropshipping Product Research", slug: "dropshipping-research" },
    { name: "Amazon FBA Listings", slug: "amazon-fba" },
    { name: "Shopify Store Setup", slug: "shopify-setup" },
    { name: "Inventory Management SOPs", slug: "inventory-management" },
    { name: "Marketplace Optimization", slug: "marketplace-optimization" },
    { name: "Product Bundle Creation", slug: "product-bundles" },
    { name: "Supplier Research", slug: "supplier-research" },
  ],
  "knowledge-education": [
    { name: "Online Course Creation", slug: "online-courses" },
    { name: "Workshop Materials", slug: "workshop-materials" },
    { name: "Paid Newsletter Content", slug: "paid-newsletters" },
    { name: "Skill Certification Modules", slug: "skill-certifications" },
    { name: "Coaching Plans", slug: "coaching-plans" },
    { name: "Study Guides", slug: "study-guides" },
    { name: "Training Manuals", slug: "training-manuals" },
  ],
  "specialized-technology": [
    { name: "AI Implementation Plans", slug: "ai-implementation" },
    { name: "Cybersecurity Audit Reports", slug: "cybersecurity-audits" },
    { name: "Real Estate Listing Automation", slug: "real-estate-automation" },
    { name: "HealthTech Wellness Content", slug: "healthtech-wellness" },
    { name: "No-Code Tool Builds", slug: "no-code-tools" },
    { name: "PropTech Lead Systems", slug: "proptech-leads" },
  ],
  "automation-no-code": [
    { name: "Zapier/Make Workflow Designs", slug: "zapier-make-workflows" },
    { name: "n8n Automation Blueprints", slug: "n8n-blueprints" },
    { name: "Airtable/Notion System Builds", slug: "airtable-notion-systems" },
    { name: "API Integration Docs", slug: "api-integrations" },
    { name: "Chatbot Flow Design", slug: "chatbot-flows" },
    { name: "CRM Automation Plans", slug: "crm-automation" },
  ],
  "space-innovation": [
    { name: "Space Tourism Content", slug: "space-tourism" },
    { name: "Satellite Data Reports", slug: "satellite-data" },
    { name: "Space Merchandise Concepts", slug: "space-merchandise" },
    { name: "Aerospace Research Briefs", slug: "aerospace-research" },
  ],
};
