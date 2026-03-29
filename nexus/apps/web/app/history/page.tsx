"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import type { WorkflowRun, WorkflowStep, RevisionEntry } from "@/lib/api";
import CacheIndicator from "@/components/CacheIndicator";

// Mock data
const MOCK_RUNS: WorkflowRun[] = [
  {
    id: "run-001",
    product_id: "prod-001",
    product_name: "Freelancer CRM System — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    batch_id: "batch-001",
    status: "completed",
    started_at: "2025-03-15T10:30:00Z",
    completed_at: "2025-03-15T10:31:15Z",
    total_tokens: 18420,
    total_cost: 0.0,
    cache_hits: 2,
    ai_models_used: ["DeepSeek-R1", "Qwen-Plus", "Llama 3.1 8B"],
    duration_ms: 75000,
  },
  {
    id: "run-002",
    product_id: "prod-002",
    product_name: "Student Planner — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    batch_id: "batch-001",
    status: "completed",
    started_at: "2025-03-15T10:35:00Z",
    completed_at: "2025-03-15T10:36:02Z",
    total_tokens: 15800,
    total_cost: 0.0,
    cache_hits: 3,
    ai_models_used: ["DeepSeek-R1", "Qwen-Plus"],
    duration_ms: 62000,
  },
  {
    id: "run-003",
    product_id: "prod-003",
    product_name: "Ultimate SEO Checklist — PDF Guide",
    domain_name: "Digital Products",
    category_name: "PDF Guides & Ebooks",
    status: "completed",
    started_at: "2025-03-10T08:00:00Z",
    completed_at: "2025-03-10T08:01:30Z",
    total_tokens: 22100,
    total_cost: 0.0,
    cache_hits: 1,
    ai_models_used: ["DeepSeek-R1", "Qwen-Plus", "Mixtral 8x7B"],
    duration_ms: 90000,
  },
  {
    id: "run-004",
    product_id: "prod-004",
    product_name: "Minimalist Mountain T-Shirt Design",
    domain_name: "Print on Demand (POD)",
    category_name: "T-Shirts & Apparel",
    batch_id: "batch-002",
    status: "failed",
    started_at: "2025-03-12T14:00:00Z",
    completed_at: "2025-03-12T14:00:45Z",
    total_tokens: 8400,
    total_cost: 0.0,
    cache_hits: 0,
    ai_models_used: ["DeepSeek-R1"],
    duration_ms: 45000,
  },
  {
    id: "run-005",
    product_id: "prod-006",
    product_name: "Podcast Launch Blueprint",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    status: "cancelled",
    started_at: "2025-03-08T09:00:00Z",
    completed_at: "2025-03-08T09:00:20Z",
    total_tokens: 3200,
    total_cost: 0.0,
    cache_hits: 0,
    ai_models_used: ["Qwen-Plus"],
    duration_ms: 20000,
  },
];

const MOCK_STEPS: Record<string, WorkflowStep[]> = {
  "run-001": [
    { id: "s1", run_id: "run-001", step_name: "Research", step_order: 1, status: "completed", ai_used: "DeepSeek-R1", ai_tried: ["DeepSeek-R1"], tokens_used: 3200, cost: 0, cached: true, latency_ms: 120 },
    { id: "s2", run_id: "run-001", step_name: "Content Generation", step_order: 2, status: "completed", ai_used: "DeepSeek-R1", ai_tried: ["DeepSeek-R1"], tokens_used: 4800, cost: 0, cached: false, latency_ms: 2400 },
    { id: "s3", run_id: "run-001", step_name: "SEO Optimization", step_order: 3, status: "completed", ai_used: "Qwen-Plus", ai_tried: ["DeepSeek-R1", "Qwen-Plus"], tokens_used: 2100, cost: 0, cached: true, latency_ms: 80 },
    { id: "s4", run_id: "run-001", step_name: "Title & Tags", step_order: 4, status: "completed", ai_used: "Qwen-Plus", ai_tried: ["Qwen-Plus"], tokens_used: 1800, cost: 0, cached: false, latency_ms: 1200 },
    { id: "s5", run_id: "run-001", step_name: "Description", step_order: 5, status: "completed", ai_used: "DeepSeek-R1", ai_tried: ["DeepSeek-R1"], tokens_used: 2400, cost: 0, cached: false, latency_ms: 1800 },
    { id: "s6", run_id: "run-001", step_name: "Pricing", step_order: 6, status: "completed", ai_used: "Llama 3.1 8B", ai_tried: ["Llama 3.1 8B"], tokens_used: 800, cost: 0, cached: false, latency_ms: 400 },
    { id: "s7", run_id: "run-001", step_name: "Image Generation", step_order: 7, status: "completed", ai_used: "FLUX", ai_tried: ["FLUX"], tokens_used: 0, cost: 0, cached: false, latency_ms: 8000 },
    { id: "s8", run_id: "run-001", step_name: "CEO Review", step_order: 8, status: "completed", ai_used: "DeepSeek-R1", ai_tried: ["DeepSeek-R1"], tokens_used: 1820, cost: 0, cached: false, latency_ms: 2200 },
    { id: "s9", run_id: "run-001", step_name: "Platform Variation", step_order: 9, status: "completed", ai_used: "Qwen-Plus", ai_tried: ["Qwen-Plus"], tokens_used: 1500, cost: 0, cached: false, latency_ms: 1600 },
  ],
};

const MOCK_REVISIONS: Record<string, RevisionEntry[]> = {
  "prod-001": [
    { id: "rev-1", product_id: "prod-001", version: 1, feedback: "Title too generic, make it more niche-specific", ai_score: 6.8, ai_model: "DeepSeek-R1", reviewed_at: "2025-03-15T10:31:00Z", decision: "rejected" },
    { id: "rev-2", product_id: "prod-001", version: 2, ai_score: 8.4, ai_model: "DeepSeek-R1", reviewed_at: "2025-03-15T10:32:30Z", decision: "approved" },
  ],
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400",
    cancelled: "bg-gray-500/10 text-gray-500",
    failed: "bg-red-500/10 text-red-400",
    running: "bg-blue-500/10 text-blue-400",
    waiting: "bg-gray-500/10 text-gray-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-gray-500/10 text-gray-400"}`}>
      {status}
    </span>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, WorkflowStep[]>>({});
  const [stepsLoading, setStepsLoading] = useState<Record<string, boolean>>({});
  const [revisionsModal, setRevisionsModal] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<RevisionEntry[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : undefined;
      const response = await api.history.listRuns(params);
      if (response.success && response.data) {
        setRuns(response.data);
        setIsUsingMock(false);
      } else {
        setRuns(MOCK_RUNS);
        setIsUsingMock(true);
      }
    } catch {
      setRuns(MOCK_RUNS);
      setIsUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const toggleExpand = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    if (!steps[runId]) {
      setStepsLoading((prev) => ({ ...prev, [runId]: true }));
      try {
        const response = await api.history.getRunSteps(runId);
        if (response.success && response.data) {
          setSteps((prev) => ({ ...prev, [runId]: response.data! }));
        } else {
          setSteps((prev) => ({
            ...prev,
            [runId]: MOCK_STEPS[runId] ?? [],
          }));
        }
      } catch {
        setSteps((prev) => ({
          ...prev,
          [runId]: MOCK_STEPS[runId] ?? [],
        }));
      } finally {
        setStepsLoading((prev) => ({ ...prev, [runId]: false }));
      }
    }
  };

  const showRevisions = async (productId: string) => {
    setRevisionsModal(productId);
    setRevisionsLoading(true);
    try {
      const response = await api.history.getRevisions(productId);
      if (response.success && response.data) {
        setRevisions(response.data);
      } else {
        setRevisions(MOCK_REVISIONS[productId] ?? []);
      }
    } catch {
      setRevisions(MOCK_REVISIONS[productId] ?? []);
    } finally {
      setRevisionsLoading(false);
    }
  };

  const filteredRuns = filterStatus
    ? runs.filter((r) => r.status === filterStatus)
    : runs;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">History</h1>
        <p className="text-muted text-sm mt-1">
          Past workflow runs and revision history
        </p>
      </div>

      {isUsingMock && <MockDataBanner />}

      {/* Filters */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
          <span className="text-sm text-muted ml-auto">
            {filteredRuns.length} run{filteredRuns.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-4 animate-pulse"
            >
              <div className="flex gap-4">
                <div className="h-5 w-48 rounded bg-card-border" />
                <div className="h-5 w-24 rounded bg-card-border" />
                <div className="h-5 w-20 rounded bg-card-border" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Domain / Category
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    AI Models
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Cache Hits
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => (
                  <>
                    <tr
                      key={run.id}
                      className={`border-b border-card-border hover:bg-card-hover transition-colors cursor-pointer ${
                        expandedRun === run.id ? "bg-card-hover" : ""
                      }`}
                      onClick={() => toggleExpand(run.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {run.product_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <div className="text-xs">
                          {run.domain_name ?? "—"}
                          {run.category_name && (
                            <>
                              <br />
                              <span className="text-muted/70">
                                {run.category_name}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 text-muted font-mono text-xs">
                        {run.total_tokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {run.ai_models_used.map((m) => (
                            <span
                              key={m}
                              className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-xs"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {run.cache_hits}
                      </td>
                      <td className="px-4 py-3 text-muted font-mono text-xs">
                        ${run.total_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {run.duration_ms
                          ? formatDuration(run.duration_ms)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {formatDate(run.started_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(run.id);
                            }}
                            className="text-xs text-accent hover:text-accent-hover transition-colors"
                          >
                            {expandedRun === run.id ? "Collapse" : "Steps"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showRevisions(run.product_id);
                            }}
                            className="text-xs text-muted hover:text-foreground transition-colors"
                          >
                            Revisions
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Step Details */}
                    {expandedRun === run.id && (
                      <tr key={`${run.id}-steps`}>
                        <td colSpan={10} className="px-0 py-0">
                          <div className="bg-background border-b border-card-border">
                            {stepsLoading[run.id] ? (
                              <div className="px-8 py-4">
                                <div className="animate-pulse space-y-2">
                                  {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-4 w-full rounded bg-card-border" />
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="px-8 py-4">
                                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                                  Workflow Steps ({(steps[run.id] ?? []).length})
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-card-border text-left">
                                        <th className="pb-2 pr-3 text-muted font-medium">#</th>
                                        <th className="pb-2 pr-3 text-muted font-medium">Step</th>
                                        <th className="pb-2 pr-3 text-muted font-medium">Status</th>
                                        <th className="pb-2 pr-3 text-muted font-medium">AI Used</th>
                                        <th className="pb-2 pr-3 text-muted font-medium">AI Tried</th>
                                        <th className="pb-2 pr-3 text-muted font-medium">Tokens</th>
                                        <th className="pb-2 pr-3 text-muted font-medium">Cost</th>
                                        <th className="pb-2 pr-3 text-muted font-medium">Cache</th>
                                        <th className="pb-2 text-muted font-medium">Latency</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(steps[run.id] ?? []).map((step) => (
                                        <tr
                                          key={step.id}
                                          className="border-b border-card-border/50 last:border-0"
                                        >
                                          <td className="py-2 pr-3 text-muted">
                                            {step.step_order}
                                          </td>
                                          <td className="py-2 pr-3 font-medium text-foreground">
                                            {step.step_name}
                                          </td>
                                          <td className="py-2 pr-3">
                                            <StatusBadge status={step.status} />
                                          </td>
                                          <td className="py-2 pr-3 text-foreground">
                                            {step.ai_used ?? "—"}
                                          </td>
                                          <td className="py-2 pr-3 text-muted">
                                            {step.ai_tried.join(", ") || "—"}
                                          </td>
                                          <td className="py-2 pr-3 text-muted font-mono">
                                            {step.tokens_used.toLocaleString()}
                                          </td>
                                          <td className="py-2 pr-3 text-muted font-mono">
                                            ${step.cost.toFixed(4)}
                                          </td>
                                          <td className="py-2 pr-3">
                                            <CacheIndicator hit={step.cached} />
                                          </td>
                                          <td className="py-2 text-muted">
                                            {step.latency_ms}ms
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredRuns.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="text-muted text-sm">No workflow runs found.</p>
        </div>
      )}

      {/* Revision History Modal */}
      {revisionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-card-border bg-card-bg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Revision History
              </h3>
              <button
                onClick={() => setRevisionsModal(null)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {revisionsLoading ? (
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 rounded bg-card-border" />
                ))}
              </div>
            ) : revisions.length === 0 ? (
              <p className="text-sm text-muted py-4">No revisions found.</p>
            ) : (
              <div className="space-y-3">
                {revisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-lg border border-card-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          Version {rev.version}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            rev.decision === "approved"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {rev.decision}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {formatDate(rev.reviewed_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted mb-2">
                      <span>
                        AI Score:{" "}
                        <span className="text-foreground font-medium">
                          {rev.ai_score}/10
                        </span>
                      </span>
                      <span>
                        Model:{" "}
                        <span className="text-foreground">{rev.ai_model}</span>
                      </span>
                    </div>
                    {rev.feedback && (
                      <p className="text-xs text-muted bg-card-hover rounded px-3 py-2 mt-2">
                        Feedback: {rev.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
