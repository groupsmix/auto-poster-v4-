// Default categories data per domain — used as fallback when API is not available

export interface CategoryData {
  name: string;
  slug: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: Record<string, CategoryData[]> = {
  "digital-products": [
    { name: "Notion Templates", slug: "notion-templates", icon: "📝" },
    { name: "PDFs & Guides", slug: "pdfs-guides", icon: "📄" },
    { name: "Courses & E-Learning", slug: "courses-e-learning", icon: "🎓" },
    { name: "Planners & Calendars", slug: "planners-calendars", icon: "📅" },
    { name: "Prompt Libraries", slug: "prompt-libraries", icon: "💡" },
    { name: "SaaS Templates", slug: "saas-templates", icon: "💻" },
    { name: "Checklists & Trackers", slug: "checklists-trackers", icon: "✅" },
    { name: "Spreadsheet Templates", slug: "spreadsheet-templates", icon: "📊" },
  ],
  "print-on-demand": [
    { name: "T-Shirts", slug: "t-shirts", icon: "👕" },
    { name: "Mugs", slug: "mugs", icon: "☕" },
    { name: "Posters & Art", slug: "posters-art", icon: "🖼️" },
    { name: "Stickers", slug: "stickers", icon: "🏷️" },
    { name: "Phone Cases", slug: "phone-cases", icon: "📱" },
  ],
  "content-media": [
    { name: "Stock Photos", slug: "stock-photos", icon: "📸" },
    { name: "Video Templates", slug: "video-templates", icon: "🎬" },
    { name: "Audio & Music", slug: "audio-music", icon: "🎵" },
    { name: "Graphics & Icons", slug: "graphics-icons", icon: "🎨" },
  ],
  "freelance-services": [
    { name: "Web Development", slug: "web-development", icon: "🌐" },
    { name: "Design Services", slug: "design-services", icon: "✏️" },
    { name: "Writing & Content", slug: "writing-content", icon: "📝" },
    { name: "Marketing", slug: "marketing", icon: "📢" },
  ],
  "affiliate-marketing": [
    { name: "Tech & Software", slug: "tech-software", icon: "💻" },
    { name: "Health & Wellness", slug: "health-wellness", icon: "🏋️" },
    { name: "Finance", slug: "finance", icon: "💰" },
    { name: "Education", slug: "education", icon: "📚" },
  ],
  "e-commerce-retail": [
    { name: "Handmade Goods", slug: "handmade-goods", icon: "🧶" },
    { name: "Vintage & Antique", slug: "vintage-antique", icon: "🏺" },
    { name: "Electronics", slug: "electronics", icon: "🔌" },
    { name: "Fashion", slug: "fashion", icon: "👗" },
  ],
  "knowledge-education": [
    { name: "Online Courses", slug: "online-courses", icon: "🎓" },
    { name: "Tutorials", slug: "tutorials", icon: "📖" },
    { name: "Workshops", slug: "workshops", icon: "🛠️" },
    { name: "Coaching", slug: "coaching", icon: "🎯" },
  ],
  "specialized-technology": [
    { name: "AI Tools", slug: "ai-tools", icon: "🤖" },
    { name: "APIs & Integrations", slug: "apis-integrations", icon: "🔗" },
    { name: "Dev Tools", slug: "dev-tools", icon: "⚙️" },
    { name: "Browser Extensions", slug: "browser-extensions", icon: "🧩" },
  ],
  "automation-no-code": [
    { name: "Zapier Templates", slug: "zapier-templates", icon: "⚡" },
    { name: "Make Scenarios", slug: "make-scenarios", icon: "🔄" },
    { name: "Airtable Bases", slug: "airtable-bases", icon: "📋" },
    { name: "Workflow Automations", slug: "workflow-automations", icon: "🤖" },
  ],
  "space-innovation": [
    { name: "Space Tech", slug: "space-tech", icon: "🛰️" },
    { name: "Green Tech", slug: "green-tech", icon: "🌱" },
    { name: "Biotech", slug: "biotech", icon: "🧬" },
    { name: "Futurism", slug: "futurism", icon: "🔮" },
  ],
};
