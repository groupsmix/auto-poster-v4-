"use client";

import { use } from "react";
import Link from "next/link";
import WorkflowProgress from "@/components/WorkflowProgress";
import BatchProgress from "@/components/BatchProgress";

export default function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Check if this is a batch workflow by URL pattern
  const isBatch = id.startsWith("batch-");

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">Workflow Progress</span>
      </div>

      {/* Back button + Title */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
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
            Workflow Progress
          </h1>
          <p className="text-muted text-sm mt-0.5">
            Live tracking with AI model and cost info
          </p>
        </div>
      </div>

      {/* Content */}
      {isBatch ? (
        <BatchProgress batchId={id} />
      ) : (
        <WorkflowProgress workflowId={id} />
      )}
    </div>
  );
}
