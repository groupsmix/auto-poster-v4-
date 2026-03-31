"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProjectBuildProgress as BuildProgress, ProjectBuildFile } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planning: "bg-blue-500/10 text-blue-400",
    plan_complete: "bg-indigo-500/10 text-indigo-400",
    building: "bg-yellow-500/10 text-yellow-400",
    validating: "bg-purple-500/10 text-purple-400",
    fixing: "bg-orange-500/10 text-orange-400",
    completed: "bg-green-500/10 text-green-400",
    failed: "bg-red-500/10 text-red-400",
    cancelled: "bg-gray-500/10 text-gray-400",
    waiting: "bg-gray-500/10 text-gray-400",
    running: "bg-blue-500/10 text-blue-400",
  };
  const labels: Record<string, string> = {
    planning: "Planning",
    plan_complete: "Plan Complete",
    building: "Building",
    validating: "Validating",
    fixing: "Fixing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    waiting: "Waiting",
    running: "Running",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-gray-500/10 text-gray-400"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function AgentRoleLabel({ role }: { role: string }) {
  const labels: Record<string, string> = {
    ceo: "AI CEO",
    architect: "AI Architect",
    contract_generator: "Contract Generator",
    contract_validator: "Contract Validator",
    designer: "AI Designer",
    db_architect: "AI DB Architect",
    backend_dev: "AI Backend Dev",
    frontend_dev: "AI Frontend Dev",
    integrator: "AI Integrator",
    structural_validator: "Structural Validator",
    code_reviewer: "AI Code Reviewer",
    qa_validator: "AI QA Validator",
    fixer: "AI Fixer",
  };
  return <span>{labels[role] ?? role}</span>;
}

function QualityBar({ score, large }: { score?: number; large?: boolean }) {
  if (score === undefined || score === null) return null;
  const pct = Math.min(score * 10, 100);
  const color = score >= 9 ? "bg-green-500" : score >= 7 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className={`${large ? "w-48 h-3" : "w-24 h-2"} bg-card-border rounded-full overflow-hidden`}>
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`${large ? "text-lg font-semibold" : "text-xs"} font-medium text-muted`}>
        {score}/10
      </span>
    </div>
  );
}

function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-card-border rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted w-12 text-right">{current}/{total}</span>
    </div>
  );
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    css: "css",
    sql: "sql",
    json: "json",
    html: "html",
    md: "markdown",
    py: "python",
  };
  return langMap[ext] ?? "text";
}

export default function ProjectBuilderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const buildId = params.id as string;

  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [files, setFiles] = useState<ProjectBuildFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"progress" | "files">("progress");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchProgress = useCallback(async () => {
    try {
      const result = await api.projectBuilder.getProgress(buildId);
      if (result.success && result.data) {
        setProgress(result.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [buildId]);

  const fetchFiles = useCallback(async () => {
    try {
      const result = await api.projectBuilder.getFiles(buildId);
      if (result.success && result.data) {
        setFiles(result.data.files);
      }
    } catch {
      // ignore
    }
  }, [buildId]);

  // Poll for progress while build is active
  useEffect(() => {
    fetchProgress();

    const isActive = progress?.status && !["completed", "failed", "cancelled"].includes(progress.status);
    if (isActive) {
      const interval = setInterval(fetchProgress, 3000);
      return () => clearInterval(interval);
    }
  }, [fetchProgress, progress?.status]);

  // Load files when switching to files tab or when build completes
  useEffect(() => {
    if (activeTab === "files") {
      fetchFiles();
    }
  }, [activeTab, fetchFiles]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.projectBuilder.cancel(buildId);
      fetchProgress();
    } finally {
      setCancelling(false);
    }
  }

  async function handleRebuild() {
    if (!feedback.trim()) return;
    setRebuilding(true);
    try {
      await api.projectBuilder.rebuild(buildId, feedback.trim());
      setFeedback("");
      fetchProgress();
    } finally {
      setRebuilding(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-card-border rounded animate-pulse" />
        <div className="h-64 bg-card-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="text-center py-16">
        <p className="text-muted">Build not found</p>
        <Link href="/project-builder" className="text-accent text-sm mt-2 inline-block">
          Back to Project Builder
        </Link>
      </div>
    );
  }

  const isActive = !["completed", "failed", "cancelled"].includes(progress.status);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/project-builder"
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Project Builder</h1>
            <p className="text-xs text-muted mt-0.5">Build ID: {buildId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={progress.status} />
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Stop Build"}
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <p className="text-xs text-muted">Quality Score</p>
          <QualityBar score={progress.quality_score} large />
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <p className="text-xs text-muted">Cycle</p>
          <p className="text-lg font-bold text-foreground mt-1">{progress.current_cycle} / {progress.max_cycles}</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <p className="text-xs text-muted">Files Generated</p>
          <p className="text-lg font-bold text-foreground mt-1">{progress.total_files}</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <p className="text-xs text-muted">Tokens Used</p>
          <p className="text-lg font-bold text-foreground mt-1">{progress.total_tokens.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <p className="text-xs text-muted">Estimated Cost</p>
          <p className="text-lg font-bold text-foreground mt-1">${progress.total_cost.toFixed(4)}</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 mb-6 border-b border-card-border">
        <button
          onClick={() => setActiveTab("progress")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "progress"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Live Progress
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "files"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Generated Files ({progress.total_files})
        </button>
      </div>

      {/* Progress Tab */}
      {activeTab === "progress" && (
        <div className="space-y-6">
          {/* Phase 1: PLAN */}
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Phase 1: PLANNING</h3>
              <StatusBadge status={progress.phases.plan.status} />
            </div>
            <div className="space-y-2">
              {progress.phases.plan.steps.map((step) => (
                <div key={step.agent_role} className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={step.status} />
                    <span className="text-sm text-foreground"><AgentRoleLabel role={step.agent_role} /></span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    {step.ai_model && <span>{step.ai_model}</span>}
                    {step.latency_ms !== undefined && <span>{(step.latency_ms / 1000).toFixed(1)}s</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 2: BUILD */}
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Phase 2: BUILDING</h3>
              <StatusBadge status={progress.phases.build.status} />
            </div>
            <div className="space-y-4">
              {progress.phases.build.layers.map((layer, layerIdx) => (
                <div key={layerIdx}>
                  <p className="text-xs text-muted mb-2">Layer {layerIdx + 1}{layerIdx === 0 ? " (No Dependencies)" : layerIdx === 1 ? " (Depends on Layer 1)" : " (Depends on Layer 2)"}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {layer.agents.map((agent) => (
                      <div key={agent.agent_role} className="flex items-center justify-between p-3 rounded-lg bg-background">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={agent.status} />
                          <span className="text-sm text-foreground"><AgentRoleLabel role={agent.agent_role} /></span>
                        </div>
                        {agent.files_generated !== undefined && (
                          <span className="text-xs text-muted">{agent.files_generated} files</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 3: VALIDATE */}
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Phase 3: VALIDATION</h3>
              <StatusBadge status={progress.phases.validate.status} />
            </div>
            <div className="space-y-2">
              {progress.phases.validate.steps.map((step) => (
                <div key={step.agent_role} className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={step.status} />
                    <span className="text-sm text-foreground"><AgentRoleLabel role={step.agent_role} /></span>
                  </div>
                  <div className="flex items-center gap-3">
                    {step.score !== undefined && <QualityBar score={step.score} />}
                    {step.issues_found !== undefined && (
                      <span className="text-xs text-muted">{step.issues_found} issues</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rebuild with Feedback */}
          {progress.status === "completed" && (
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Rebuild with Feedback</h3>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe what you'd like changed or improved..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none mb-3"
              />
              <button
                onClick={handleRebuild}
                disabled={rebuilding || !feedback.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {rebuilding ? "Rebuilding..." : "Rebuild with Feedback"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Files Tab */}
      {activeTab === "files" && (
        <div className="flex gap-4">
          {/* File tree */}
          <div className="w-72 shrink-0 rounded-xl border border-card-border bg-card-bg p-3 max-h-[600px] overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted uppercase mb-2">Files ({files.length})</h3>
            {files.length === 0 ? (
              <p className="text-sm text-muted py-4">No files generated yet.</p>
            ) : (
              <div className="space-y-0.5">
                {files.map((file) => (
                  <button
                    key={file.file_path}
                    onClick={() => setSelectedFile(file.file_path)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                      selectedFile === file.file_path
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:text-foreground hover:bg-card-hover"
                    }`}
                  >
                    {file.file_path}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* File content */}
          <div className="flex-1 rounded-xl border border-card-border bg-card-bg overflow-hidden">
            {selectedFile ? (
              <div>
                <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-card-border">
                  <span className="text-xs font-mono text-muted">{selectedFile}</span>
                  <span className="text-xs text-muted">
                    {getLanguageFromPath(selectedFile)}
                  </span>
                </div>
                <pre className="p-4 text-sm font-mono text-foreground overflow-x-auto max-h-[540px] overflow-y-auto">
                  <code>
                    {files.find((f) => f.file_path === selectedFile)?.content ?? ""}
                  </code>
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted text-sm">
                Select a file to view its content
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
