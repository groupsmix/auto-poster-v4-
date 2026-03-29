"use client";

import { use } from "react";
import Link from "next/link";

export default function CategoryPage({
  params,
}: {
  params: Promise<{ domain: string; category: string }>;
}) {
  const { domain, category } = use(params);
  const domainDisplay = domain.replace(/-/g, " ");
  const categoryDisplay = category.replace(/-/g, " ");

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href={`/${domain}`} className="hover:text-foreground transition-colors capitalize">{domainDisplay}</Link>
        <span>/</span>
        <span className="text-foreground capitalize">{categoryDisplay}</span>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/${domain}`}
          className="p-2 rounded-lg border border-card-border hover:bg-card-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground capitalize">{categoryDisplay}</h1>
          <p className="text-muted text-sm mt-0.5">Product setup form</p>
        </div>
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
        <p className="text-muted text-sm">Product setup form will be rendered here.</p>
      </div>
    </div>
  );
}
