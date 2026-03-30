"use client";

import { use } from "react";
import Link from "next/link";
import ReviewScreen from "@/components/ReviewScreen";
import { ArrowLeftIcon } from "@/components/icons/Icons";

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/review" className="hover:text-foreground transition-colors">
          Review
        </Link>
        <span>/</span>
        <span className="text-foreground">CEO Review</span>
      </div>

      {/* Back button + Title */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/review"
          className="p-2 rounded-lg border border-card-border hover:bg-card-hover transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">CEO Review</h1>
          <p className="text-muted text-sm mt-0.5">
            Review and approve product output
          </p>
        </div>
      </div>

      {/* Review Screen */}
      <ReviewScreen productId={id} />
    </div>
  );
}
