"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import AIStatusBadge from "./AIStatusBadge";

export interface WorkflowStep {
  name: string;
  status: "done" | "running" | "waiting" | "failed";
  duration?: number;
  model?: string;
}

export interface WorkflowData {
  id: string;
  product_name: string;
  domain?: string;
  category?: string;
  status: "running" | "pending_review" | "completed" | "failed" | "cancelled";
  current_step: number;
  total_steps: number;
  steps: WorkflowStep[];
  cost_so_far: number;
  tokens_used: number;
  cache_hits: number;
  batch_id?: string;
}

interface WorkflowProgressProps {
  workflowId: string;
}

// Mock data for when API is not available
const MOCK_WORKFLOW: WorkflowData = {
  id: "wf-demo",
  product_name: "Freelancer CRM System",
  domain: "digital-products",
  category: "notion-templates",
  status: "running",
  current_step: 3,
  total_steps: 9,
  steps: [
    { name: "Market Research", status: "done", duration: 2.3, model: "DeepSeek-V3" },
    { name: "Strategy Planning", status: "done", duration: 1.8, model: "Qwen 3.5" },
    { name: "Content Generation", status: "running", model: "DeepSeek-V3" },
    { name: "SEO Optimization", status: "waiting" },
    { name: "Platform Adaptation", status: "waiting" },
    { name: "Image Generation", status: "waiting" },
    { name: "Social Content", status: "waiting" },
    { name: "Quality Review", status: "waiting" },
    { name: "Final Package", status: "waiting" },
  ],
  cost_so_far: 0.003,
  tokens_used: 4231,
  cache_hits: 1,
};

export default function WorkflowProgress({ workflowId }: WorkflowProgressProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<WorkflowData>(MOCK_WORKFLOW);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchProgress = async () => {
      try {
        const response = await api.get<WorkflowData>(`/workflow/${workflowId}`);
        if (!cancelled && response.success && response.data) {
          setWorkflow(response.data);
          if (response.data.status === "pending_review") {
            router.push(`/review/${response.data.id}`);
          }
        }
      } catch {
        // Keep showing current state on error
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workflowId, router]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/workflow/${workflowId}/cancel`, {});
      setWorkflow((prev) => ({ ...prev, status: "cancelled" }));
    } catch {
      // Ignore cancel errors
    } finally {
      setCancelling(false);
    }
  };

  const progressPercent = (workflow.current_step / workflow.total_steps) * 100;

  const stepStatusIcon = (status: WorkflowStep["status"]) => {
    switch (status) {
      case "done":
        return (
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">
            &#10003;
          </span>
        );
      case "running":
        return (
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent">
            <span className="animate-spin text-xs">&#9696;</span>
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
            &#10007;
          </span>
        );
      default:
        return (
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-card-hover text-muted text-xs">
            &bull;
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {workflow.product_name}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <AIStatusBadge
              status={
                workflow.status === "running"
                  ? "active"
                  : workflow.status === "cancelled"
                    ? "sleeping"
                    : workflow.status
              }
            />
            <span className="text-sm text-muted">
              Step {workflow.current_step} of {workflow.total_steps}
            </span>
          </div>
        </div>
        {workflow.status === "running" && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            {cancelling ? "Cancelling..." : "CANCEL WORKFLOW"}
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>
            {workflow.status === "running"
              ? `RUNNING Step ${workflow.current_step} of ${workflow.total_steps}`
              : workflow.status.toUpperCase().replace("_", " ")}
          </span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2.5 bg-card-hover rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              workflow.status === "failed" || workflow.status === "cancelled"
                ? "bg-red-500"
                : workflow.status === "pending_review" || workflow.status === "completed"
                  ? "bg-green-500"
                  : "bg-accent"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step List */}
      <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
        {workflow.steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 ${
              i < workflow.steps.length - 1 ? "border-b border-card-border" : ""
            } ${step.status === "running" ? "bg-accent/5" : ""}`}
          >
            {stepStatusIcon(step.status)}
            <div className="flex-1 min-w-0">
              <span
                className={`text-sm font-medium ${
                  step.status === "waiting"
                    ? "text-muted"
                    : step.status === "running"
                      ? "text-accent"
                      : "text-foreground"
                }`}
              >
                Step {i + 1}: {step.name}
              </span>
            </div>
            {step.status === "done" && (
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{step.duration?.toFixed(1)}s</span>
                <span className="text-foreground/60">{step.model}</span>
              </div>
            )}
            {step.status === "running" && step.model && (
              <span className="text-xs text-accent">{step.model}</span>
            )}
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card-bg border border-card-border">
          <span className="text-muted">AI Cost So Far:</span>
          <span className="font-medium text-foreground">
            ${workflow.cost_so_far.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card-bg border border-card-border">
          <span className="text-muted">Tokens Used:</span>
          <span className="font-medium text-foreground">
            {workflow.tokens_used.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card-bg border border-card-border">
          <span className="text-muted">Cache Hits:</span>
          <span className="font-medium text-foreground">
            {workflow.cache_hits}
          </span>
        </div>
      </div>

      {/* Completion state */}
      {workflow.status === "pending_review" && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-center">
          <p className="text-green-400 font-medium mb-2">
            Workflow Complete — Ready for Review
          </p>
          <button
            onClick={() => router.push(`/review/${workflow.id}`)}
            className="px-6 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            Go to CEO Review
          </button>
        </div>
      )}

      {workflow.status === "cancelled" && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
          <p className="text-red-400 font-medium">Workflow Cancelled</p>
        </div>
      )}
    </div>
  );
}
