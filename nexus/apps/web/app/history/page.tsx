"use client";

import { useState, Fragment } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import Modal from "@/components/Modal";
import { useApiQuery } from "@/lib/useApiQuery";
import StatusBadge from "@/components/StatusBadge";
import { SearchIcon } from "@/components/icons/Icons";
import { MOCK_RUNS, MOCK_STEPS, MOCK_REVISIONS } from "@/lib/mock-data";
import { formatDateTime, formatDuration } from "@/lib/format";
import { toast } from "sonner";
import type { WorkflowStep, RevisionEntry } from "@/lib/api";
import CacheIndicator from "@/components/CacheIndicator";


export default function HistoryPage() {
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: runs, loading, isUsingMock } = useApiQuery(
    () => api.history.listRuns(),
    MOCK_RUNS,
  );

  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, WorkflowStep[]>>({});
  const [stepsLoading, setStepsLoading] = useState<Record<string, boolean>>({});
  const [revisionsModal, setRevisionsModal] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<RevisionEntry[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

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
          setSteps((prev) => ({ ...prev, [runId]: response.data ?? [] }));
        } else {
          setSteps((prev) => ({
            ...prev,
            [runId]: MOCK_STEPS[runId] ?? [],
          }));
        }
      } catch {
        toast.error("Failed to load workflow steps");
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
      toast.error("Failed to load revisions");
      setRevisions(MOCK_REVISIONS[productId] ?? []);
    } finally {
      setRevisionsLoading(false);
    }
  };

  // 6.1: Client-side filtering only (mock data doesn't support server-side filtering)
  const filteredRuns = runs.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !(r.product_name ?? "").toLowerCase().includes(q) &&
        !(r.domain_name ?? "").toLowerCase().includes(q) &&
        !(r.category_name ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

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
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search runs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent w-48"
            />
          </div>
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
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden md:table-cell">
                    Domain / Category
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden lg:table-cell">
                    AI Models
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden lg:table-cell">
                    Cache Hits
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden xl:table-cell">
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
                  <Fragment key={run.id}>
                    <tr
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
                      <td className="px-4 py-3 text-muted hidden md:table-cell">
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
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(run.ai_models_used ?? []).map((m) => (
                            <span
                              key={m}
                              className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-xs"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs hidden lg:table-cell">
                        {run.cache_hits}
                      </td>
                      <td className="px-4 py-3 text-muted font-mono text-xs hidden xl:table-cell">
                        ${run.total_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {run.duration_ms
                          ? formatDuration(run.duration_ms)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {formatDateTime(run.started_at ?? "")}
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
                                            {(step.ai_tried ?? []).join(", ") || "—"}
                                          </td>
                                          <td className="py-2 pr-3 text-muted font-mono">
                                            {(step.tokens_used ?? 0).toLocaleString()}
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
                  </Fragment>
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
      <Modal
        isOpen={!!revisionsModal}
        onClose={() => setRevisionsModal(null)}
        title="Revision History"
        maxWidth="2xl"
      >
        <div className="max-h-[60vh] overflow-y-auto">
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
                      {formatDateTime(rev.reviewed_at)}
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
      </Modal>
    </div>
  );
}
