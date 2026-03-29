"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface BatchProduct {
  id: string;
  name: string;
  status: "done" | "running" | "queued" | "failed";
  current_step?: number;
  total_steps?: number;
  review_status?: "pending_review" | "approved" | "rejected";
}

export interface BatchData {
  id: string;
  title: string;
  niche: string;
  total: number;
  completed: number;
  products: BatchProduct[];
}

interface BatchProgressProps {
  batchId: string;
}

// Mock data for when API is not available
const MOCK_BATCH: BatchData = {
  id: "batch-demo",
  title: "5 Notion Templates",
  niche: "productivity",
  total: 5,
  completed: 1,
  products: [
    { id: "p1", name: "Freelancer CRM", status: "done", review_status: "pending_review" },
    { id: "p2", name: "Student Planner", status: "running", current_step: 4, total_steps: 9 },
    { id: "p3", name: "Budget Tracker", status: "queued" },
    { id: "p4", name: "Habit Tracker", status: "queued" },
    { id: "p5", name: "Project Manager", status: "queued" },
  ],
};

export default function BatchProgress({ batchId }: BatchProgressProps) {
  const router = useRouter();
  const [batch, setBatch] = useState<BatchData>(MOCK_BATCH);

  useEffect(() => {
    let cancelled = false;

    const fetchBatch = async () => {
      try {
        const response = await api.get<BatchData>(`/workflow/batch/${batchId}`);
        if (!cancelled && response.success && response.data) {
          setBatch(response.data);
        }
      } catch {
        // Keep showing current state
      }
    };

    fetchBatch();
    const interval = setInterval(fetchBatch, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [batchId]);

  const statusBadge = (product: BatchProduct) => {
    if (product.status === "done" && product.review_status) {
      const label =
        product.review_status === "pending_review"
          ? "Pending Review"
          : product.review_status === "approved"
            ? "Approved"
            : "Rejected";
      const color =
        product.review_status === "pending_review"
          ? "text-yellow-400 bg-yellow-500/10"
          : product.review_status === "approved"
            ? "text-green-400 bg-green-500/10"
            : "text-red-400 bg-red-500/10";
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${color}`}>
          {label}
        </span>
      );
    }
    if (product.status === "running") {
      return (
        <span className="text-xs font-medium px-2 py-0.5 rounded text-accent bg-accent/10">
          Running — Step {product.current_step}/{product.total_steps}
        </span>
      );
    }
    if (product.status === "queued") {
      return (
        <span className="text-xs font-medium px-2 py-0.5 rounded text-muted bg-card-hover">
          Queued
        </span>
      );
    }
    if (product.status === "failed") {
      return (
        <span className="text-xs font-medium px-2 py-0.5 rounded text-red-400 bg-red-500/10">
          Failed
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Batch Header */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="text-base font-semibold text-foreground">
          Batch: {batch.total} {batch.title} for &ldquo;{batch.niche}&rdquo;
        </h3>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 bg-card-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(batch.completed / batch.total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted">
            {batch.completed}/{batch.total}
          </span>
        </div>
      </div>

      {/* Product List */}
      <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
        {batch.products.map((product, i) => (
          <div
            key={product.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              i < batch.products.length - 1 ? "border-b border-card-border" : ""
            } ${product.status === "running" ? "bg-accent/5" : ""}`}
          >
            <span className="text-sm text-muted w-16">
              Product {i + 1}/{batch.total}:
            </span>
            <span
              className={`text-sm font-medium flex-1 ${
                product.status === "queued" ? "text-muted" : "text-foreground"
              }`}
            >
              {product.name || "—"}
            </span>
            {statusBadge(product)}
            {product.status === "done" &&
              product.review_status === "pending_review" && (
                <button
                  onClick={() => router.push(`/review/${product.id}`)}
                  className="text-xs text-accent hover:underline ml-2"
                >
                  Review
                </button>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
