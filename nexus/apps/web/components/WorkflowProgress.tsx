"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
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


function LastUpdatedIndicator({ lastUpdated }: { lastUpdated: Date }) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const tick = () => setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <span className="text-xs text-muted">
      Last updated {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}
    </span>
  );
}

export default function WorkflowProgress({ workflowId }: WorkflowProgressProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [manualRefresh, setManualRefresh] = useState(0);
  const errorShownRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const TERMINAL_STATES = ["completed", "failed", "cancelled", "pending_review"];

    const fetchProgress = async () => {
      try {
        const response = await api.get<WorkflowData>(`/workflow/${workflowId}`);
        if (!cancelled) {
          if (response.success && response.data) {
            setWorkflow(response.data);
            setLoading(false);
            setError(null);
            setLastUpdated(new Date());
            if (response.data.status === "pending_review") {
              router.push(`/review/${response.data.id}`);
            }
            // Stop polling on terminal states
            if (TERMINAL_STATES.includes(response.data.status)) {
              cancelled = true;
            }
          } else if (!workflow) {
            setError(response.error || "Failed to load workflow");
            setLoading(false);
          }
        }
      } catch {
        if (!cancelled) {
          if (!workflow) {
            setError("Failed to fetch workflow progress");
            setLoading(false);
          }
          // Only show error toast once to avoid spamming during polling
          if (!errorShownRef.current) {
            errorShownRef.current = true;
            toast.error("Failed to fetch workflow progress");
          }
        }
      }
    };

    fetchProgress();
    let pollCount = 0;
    const getInterval = () => {
      if (pollCount > 30) return 5000;
      if (pollCount > 10) return 3000;
      return 1000;
    };
    const schedulePoll = () => {
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        pollCount++;
        await fetchProgress();
        if (!cancelled) {
          schedulePoll();
        }
      }, getInterval());
    };
    schedulePoll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [workflowId, router, manualRefresh]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/workflow/${workflowId}/cancel`, {});
      setWorkflow((prev) => prev ? { ...prev, status: "cancelled" } : prev);
    } catch {
      toast.error("Failed to cancel workflow");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse">
            <div className="h-5 w-48 rounded bg-card-border mb-3" />
            <div className="h-4 w-full rounded bg-card-border mb-2" />
            <div className="h-4 w-3/4 rounded bg-card-border" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load workflow</h3>
        <p className="text-muted text-sm text-center max-w-md mb-4">{error || "Workflow not found"}</p>
        <button
          onClick={() => setManualRefresh((n) => n + 1)}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

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
                (workflow.status === "running"
                  ? "active"
                  : workflow.status === "cancelled"
                    ? "sleeping"
                    : workflow.status) as import("@nexus/shared").AIModelStatus
              }
            />
            <span className="text-sm text-muted">
              Step {workflow.current_step} of {workflow.total_steps}
            </span>
          </div>
        </div>
        {workflow.status === "running" && (
          cancelConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Are you sure?</span>
              <button
                onClick={() => { handleCancel(); setCancelConfirm(false); }}
                disabled={cancelling}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
              <button
                onClick={() => setCancelConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
              >
                Keep Running
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCancelConfirm(true)}
              disabled={cancelling}
              className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-40"
            >
              CANCEL WORKFLOW
            </button>
          )
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
      <div className="flex items-center justify-between mb-2">
        <LastUpdatedIndicator lastUpdated={lastUpdated} />
        <button
          onClick={() => setManualRefresh((n) => n + 1)}
          className="px-3 py-1.5 rounded-lg border border-card-border text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors"
        >
          Refresh Now
        </button>
      </div>
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
