"use client";

import { use } from "react";
import Link from "next/link";

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div>
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
          <h1 className="text-2xl font-bold text-foreground">CEO Review</h1>
          <p className="text-muted text-sm mt-0.5">Review and approve product output</p>
        </div>
      </div>
      <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
        <p className="text-muted text-sm">Review screen for product {id} will be displayed here.</p>
      </div>
    </div>
  );
}
