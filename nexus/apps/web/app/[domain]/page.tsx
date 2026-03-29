"use client";

import { use } from "react";
import Link from "next/link";
import { DEFAULT_DOMAINS } from "@/lib/domains";

export default function DomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = use(params);

  // Find the domain data from defaults
  const domainData = DEFAULT_DOMAINS.find((d) => d.slug === domain);
  const displayName = domainData?.name || domain.replace(/-/g, " ");

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link
          href="/"
          className="hover:text-foreground transition-colors"
        >
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">{displayName}</span>
      </div>

      {/* Back button + Title */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
          className="p-2 rounded-lg border border-card-border hover:bg-card-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {domainData?.icon && (
              <span className="mr-2">{domainData.icon}</span>
            )}
            {displayName}
          </h1>
          <p className="text-muted text-sm mt-0.5">
            Select a category to create a product
          </p>
        </div>
      </div>

      {/* Placeholder for category cards */}
      <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
        <p className="text-muted text-sm">
          Category cards for this domain will be loaded here.
        </p>
      </div>
    </div>
  );
}
