import { DEFAULT_DOMAINS, DEFAULT_CATEGORIES } from "@/lib/domains";
import CategoryPageClient from "./CategoryPageClient";

// Allow client-side navigation to dynamically created categories
export const dynamicParams = true;

export function generateStaticParams() {
  const params: { domain: string; category: string }[] = [];
  for (const d of DEFAULT_DOMAINS) {
    const cats = DEFAULT_CATEGORIES[d.slug] || [];
    for (const c of cats) {
      params.push({ domain: d.slug, category: c.slug });
    }
  }
  return params;
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ domain: string; category: string }>;
}) {
  const { domain, category } = await params;
  return <CategoryPageClient domain={domain} category={category} />;
}
