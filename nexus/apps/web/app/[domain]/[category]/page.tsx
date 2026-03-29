"use client";

import { use } from "react";
import Link from "next/link";
import ProductSetupForm from "@/components/ProductSetupForm";
import { DEFAULT_DOMAINS, DEFAULT_CATEGORIES } from "@/lib/domains";

export default function CategoryPage({
  params,
}: {
  params: Promise<{ domain: string; category: string }>;
}) {
  const { domain, category } = use(params);

  const domainData = DEFAULT_DOMAINS.find((d) => d.slug === domain);
  const domainDisplay = domainData?.name || domain.replace(/-/g, " ");
  const categories = DEFAULT_CATEGORIES[domain] || [];
  const categoryData = categories.find((c) => c.slug === category);
  const categoryDisplay = categoryData?.name || category.replace(/-/g, " ");

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/${domain}`}
          className="hover:text-foreground transition-colors"
        >
          {domainDisplay}
        </Link>
        <span>/</span>
        <span className="text-foreground">{categoryDisplay}</span>
      </div>

      {/* Back button + Title */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/${domain}`}
          className="p-2 rounded-lg border border-card-border hover:bg-card-hover transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {categoryDisplay}
          </h1>
          <p className="text-muted text-sm mt-0.5">
            Configure your product and start the AI workflow
          </p>
        </div>
      </div>

      {/* Product Setup Form */}
      <div className="rounded-xl border border-card-border bg-card-bg p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground mb-6">
          Product Setup
        </h2>
        <ProductSetupForm domainSlug={domain} categorySlug={category} />
      </div>
    </div>
  );
}
