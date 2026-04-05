"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import StatusBadge from "@/components/StatusBadge";
import { ExternalLinkIcon, CloudIcon, WarningIcon, Bars3Icon } from "@/components/icons/Icons";
import { toast } from "sonner";
import type { AIModel } from "@/lib/api";

// Task type labels for grouping
const TASK_TYPES = [
  { key: "research", label: "Research" },
  { key: "writing", label: "Writing & Content" },
  { key: "seo", label: "SEO Formatting" },
  { key: "reasoning", label: "Reasoning & Analysis" },
  { key: "code", label: "Code Generation" },
  { key: "image", label: "Image & Visual" },
  { key: "audio", label: "Audio & Music" },
  { key: "variation", label: "Platform Variation" },
  { key: "social", label: "Social Adaptation" },
  { key: "review", label: "CEO Review" },
] as const;

function HealthBar({ score, size = "normal" }: { score: number; size?: "normal" | "small" }) {
  const color =
    score >= 90 ? "bg-green-500" :
    score >= 70 ? "bg-yellow-500" :
    score >= 50 ? "bg-orange-500" : "bg-red-500";

  const height = size === "small" ? "h-1.5" : "h-2";

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} bg-card-hover rounded-full overflow-hidden`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${
        score >= 90 ? "text-green-400" :
        score >= 70 ? "text-yellow-400" :
        score >= 50 ? "text-orange-400" : "text-red-400"
      }`}>
        {score}%
      </span>
    </div>
  );
}

function formatLatency(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function AIManagerPage() {
  const { data: fetchedModels, loading } = useApiQuery(
    () => api.aiModels.list(),
    [],
  );

  const [models, setModels] = useState<AIModel[]>([]);
  const [activeTaskType, setActiveTaskType] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState<{ modelId: string; value: string } | null>(null);
  const [addingKey, setAddingKey] = useState(false);
  const [dragState, setDragState] = useState<{ taskType: string; dragIdx: number; overIdx: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, boolean>>({});

  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  // Sync hook data into local mutable state
  useEffect(() => {
    setModels(fetchedModels);
  }, [fetchedModels]);

  // Group models by task type
  const modelsByTask: Record<string, AIModel[]> = {};
  for (const model of models) {
    if (!modelsByTask[model.task_type]) {
      modelsByTask[model.task_type] = [];
    }
    modelsByTask[model.task_type].push(model);
  }
  // Sort each group by rank
  for (const key of Object.keys(modelsByTask)) {
    modelsByTask[key].sort((a, b) => a.rank - b.rank);
  }

  // Check for auto-suggest reorder (model #2 has higher health than #1)
  useEffect(() => {
    const newSuggestions: Record<string, boolean> = {};
    for (const [taskType, taskModels] of Object.entries(modelsByTask)) {
      if (taskModels.length >= 2) {
        const first = taskModels[0];
        const second = taskModels[1];
        if (
          second.health_score > first.health_score &&
          second.total_calls > 50 &&
          first.total_calls > 50
        ) {
          newSuggestions[taskType] = true;
        }
      }
    }
    setSuggestions(newSuggestions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  const handleAddKey = async (modelId: string) => {
    if (!keyInput || keyInput.modelId !== modelId || !keyInput.value.trim()) return;
    setAddingKey(true);
    try {
      await api.aiModels.addKey(modelId, keyInput.value.trim());
      toast.success("API key added");
    } catch {
      toast.error("Failed to add API key");
    }
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId ? { ...m, status: "active", health_score: 100 } : m
      )
    );
    setKeyInput(null);
    setAddingKey(false);
  };

  const handleRemoveKey = async (modelId: string) => {
    try {
      await api.aiModels.removeKey(modelId);
      toast.success("API key removed");
    } catch {
      toast.error("Failed to remove API key");
    }
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId ? { ...m, status: "sleeping", health_score: 0, total_calls: 0, total_failures: 0, avg_latency_ms: 0 } : m
      )
    );
  };

  const handleDragStart = (taskType: string, idx: number) => {
    dragItemRef.current = idx;
    setDragState({ taskType, dragIdx: idx, overIdx: idx });
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverRef.current = idx;
    if (dragState) {
      setDragState({ ...dragState, overIdx: idx });
    }
  };

  const handleDrop = async (taskType: string) => {
    if (dragItemRef.current === null || dragOverRef.current === null) return;
    const taskModels = [...(modelsByTask[taskType] ?? [])];
    const dragIdx = dragItemRef.current;
    const dropIdx = dragOverRef.current;

    if (dragIdx === dropIdx) {
      setDragState(null);
      return;
    }

    const [removed] = taskModels.splice(dragIdx, 1);
    taskModels.splice(dropIdx, 0, removed);

    // Update ranks
    const updatedModels = taskModels.map((m, i) => ({ ...m, rank: i + 1 }));
    setModels((prev) => {
      const others = prev.filter((m) => m.task_type !== taskType);
      return [...others, ...updatedModels];
    });

    try {
      await api.aiModels.reorder(taskType, updatedModels.map((m) => m.id));
      toast.success("Model priority updated");
    } catch {
      toast.error("Failed to save model order");
    }

    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragState(null);
  };

  // Visible task types: either all, or filtered
  const visibleTaskTypes = activeTaskType
    ? TASK_TYPES.filter((t) => t.key === activeTaskType)
    : TASK_TYPES.filter((t) => modelsByTask[t.key]?.length);

  // Workers AI summary
  const workersAIModels = models.filter((m) => m.is_workers_ai);
  const workersAITotalCalls = workersAIModels.reduce((sum, m) => sum + m.total_calls, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Manager</h1>
          <p className="text-muted text-sm mt-1">
            AI models, health scores, and failover chains
          </p>
        </div>
        <a
          href="https://dash.cloudflare.com/?to=/:account/ai/ai-gateway"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-2"
        >
          <ExternalLinkIcon className="w-4 h-4" />
          AI Gateway Dashboard
        </a>
      </div>

      {/* Workers AI summary card */}
      <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CloudIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Workers AI — Always Active</h3>
              <p className="text-xs text-muted">On-platform fallback. No API key needed. 10,000 neurons/day included free.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <div>
              <span className="text-foreground font-mono">{workersAITotalCalls}</span> total calls
            </div>
            <div>
              <span className="text-foreground font-mono">0</span> failures
            </div>
            <StatusBadge status="active" />
          </div>
        </div>
      </div>

      {/* Task type filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTaskType(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTaskType === null
              ? "bg-accent text-white"
              : "bg-card-bg border border-card-border text-muted hover:text-foreground hover:bg-card-hover"
          }`}
        >
          All Types
        </button>
        {TASK_TYPES.map((t) => {
          const count = modelsByTask[t.key]?.length ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTaskType(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTaskType === t.key
                  ? "bg-accent text-white"
                  : "bg-card-bg border border-card-border text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${activeTaskType === t.key ? "opacity-70" : ""}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse">
              <div className="h-5 bg-card-hover rounded w-40 mb-4" />
              <div className="space-y-3">
                <div className="h-16 bg-card-hover rounded" />
                <div className="h-16 bg-card-hover rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Model groups by task type */}
      {!loading && (
        <div className="space-y-6">
          {visibleTaskTypes.map(({ key: taskType, label }) => {
            const taskModels = modelsByTask[taskType];
            if (!taskModels?.length) return null;

            return (
              <div key={taskType} className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                {/* Group header */}
                <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-foreground">{label}</h2>
                    <span className="text-xs text-muted">
                      {taskModels.filter((m) => m.status === "active").length} active / {taskModels.length} total
                    </span>
                  </div>
                  <span className="text-xs text-muted">Drag to reorder failover priority</span>
                </div>

                {/* Reorder suggestion banner */}
                {suggestions[taskType] && (
                  <div className="px-6 py-3 bg-yellow-500/5 border-b border-yellow-500/20 flex items-center gap-2 text-xs text-yellow-400">
                    <WarningIcon className="w-4 h-4 shrink-0" />
                    <span>
                      <strong>{taskModels[1]?.name}</strong> has higher health ({taskModels[1]?.health_score}%) than <strong>{taskModels[0]?.name}</strong> ({taskModels[0]?.health_score}%). Consider reordering.
                    </span>
                    <button
                      onClick={() => setSuggestions((prev) => ({ ...prev, [taskType]: false }))}
                      className="ml-auto text-muted hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Model list */}
                <div className="divide-y divide-card-border">
                  {taskModels.map((model, idx) => (
                    <div
                      key={model.id}
                      draggable
                      onDragStart={() => handleDragStart(taskType, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(taskType)}
                      onDragEnd={() => setDragState(null)}
                      className={`px-6 py-4 flex items-center gap-4 transition-all cursor-grab active:cursor-grabbing ${
                        dragState?.taskType === taskType && dragState.dragIdx === idx
                          ? "opacity-50 scale-[0.98] ring-1 ring-accent/30"
                          : dragState?.taskType === taskType && dragState.overIdx === idx
                            ? "bg-accent/10 border-t-2 border-t-accent"
                            : "hover:bg-card-hover"
                      } ${model.is_workers_ai ? "bg-green-500/[0.02]" : ""}`}
                    >
                      {/* Drag handle + rank */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Bars3Icon className="w-4 h-4 text-muted" />
                        <span className="w-6 h-6 rounded bg-card-hover flex items-center justify-center text-xs font-mono text-muted">
                          {model.rank}
                        </span>
                      </div>

                      {/* Model info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{model.name}</span>
                          <span className="text-xs text-muted">{model.provider}</span>
                          {model.is_workers_ai && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                              Workers AI
                            </span>
                          )}
                          {!model.is_free_tier && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                              Paid
                            </span>
                          )}
                        </div>
                        {model.notes && (
                          <p className="text-xs text-muted truncate">{model.notes}</p>
                        )}
                      </div>

                      {/* Health bar */}
                      <div className="w-32 shrink-0">
                        {model.status === "active" || model.status === "rate_limited" ? (
                          <HealthBar score={model.health_score} size="small" />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 shrink-0 text-xs text-muted">
                        <div className="text-right w-16">
                          <div className="text-foreground font-mono">{formatLatency(model.avg_latency_ms)}</div>
                          <div>avg latency</div>
                        </div>
                        <div className="text-right w-16">
                          <div className="text-foreground font-mono">{formatNumber(model.total_calls)}</div>
                          <div>calls</div>
                        </div>
                        <div className="text-right w-16">
                          <div className={`font-mono ${model.total_failures > 0 ? "text-red-400" : "text-foreground"}`}>
                            {formatNumber(model.total_failures)}
                          </div>
                          <div>failures</div>
                        </div>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadge status={model.status} />

                        {model.status === "sleeping" && !model.is_workers_ai && (
                          <>
                            {keyInput?.modelId === model.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="password"
                                  value={keyInput.value}
                                  onChange={(e) => setKeyInput({ modelId: model.id, value: e.target.value })}
                                  placeholder="Paste API key..."
                                  className="w-40 px-2 py-1 rounded border border-card-border bg-[#111] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleAddKey(model.id)}
                                  disabled={addingKey || !keyInput.value.trim()}
                                  className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                  {addingKey ? "..." : "Add"}
                                </button>
                                <button
                                  onClick={() => setKeyInput(null)}
                                  className="px-2 py-1 rounded text-xs text-muted hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setKeyInput({ modelId: model.id, value: "" })}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                              >
                                Add API Key
                              </button>
                            )}
                          </>
                        )}

                        {model.status === "active" && !model.is_workers_ai && (
                          <button
                            onClick={() => handleRemoveKey(model.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-muted hover:text-red-400 hover:border-red-500/30 transition-colors"
                          >
                            Remove Key
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
