"use client";

import Link from "next/link";
import WorkflowProgress from "@/components/WorkflowProgress";
import BatchProgress from "@/components/BatchProgress";
import { ArrowLeftIcon } from "@/components/icons/Icons";

export default function WorkflowPageClient({ id }: { id: string }) {
  const isBatch = id.startsWith("batch-");

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/products" className="hover:text-foreground transition-colors">
          Products
        </Link>
        <span>/</span>
        <span className="text-foreground">Workflow Progress</span>
      </div>

      {/* Back button + Title */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/products"
          className="p-2 rounded-lg border border-card-border hover:bg-card-hover transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
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
