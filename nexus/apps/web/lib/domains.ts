// Default domains data — used as fallback when API is not available

export interface DomainData {
  name: string;
  slug: string;
  icon: string;
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
