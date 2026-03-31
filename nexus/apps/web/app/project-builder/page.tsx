"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { ProjectBuild } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";

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
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-gray-500/10 text-gray-400"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const styles: Record<string, string> = {
    plan: "bg-blue-500/10 text-blue-400",
    build: "bg-yellow-500/10 text-yellow-400",
    validate: "bg-purple-500/10 text-purple-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[phase] ?? "bg-gray-500/10 text-gray-400"}`}>
      {phase.charAt(0).toUpperCase() + phase.slice(1)}
    </span>
  );
}

function QualityBar({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const pct = Math.min(score * 10, 100);
  const color = score >= 9 ? "bg-green-500" : score >= 7 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-card-border rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-muted">{score}/10</span>
    </div>
  );
}

export default function ProjectBuilderPage() {
  const { data, loading, refetch } = useApiQuery(
    () => api.projectBuilder.list(),
    { builds: [] as ProjectBuild[], total: 0 },
  );

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [idea, setIdea] = useState("");
  const [techStack, setTechStack] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [designStyle, setDesignStyle] = useState("");
  const [features, setFeatures] = useState("");

  async function handleCreate() {
    if (!idea.trim()) return;
    setCreating(true);
    try {
      const featureList = features
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      await api.projectBuilder.start({
        idea: idea.trim(),
        tech_stack: techStack.trim() || undefined,
        target_user: targetUser.trim() || undefined,
        design_style: designStyle.trim() || undefined,
        features: featureList.length > 0 ? featureList : undefined,
      });

      setShowCreate(false);
      setIdea("");
      setTechStack("");
      setTargetUser("");
      setDesignStyle("");
      setFeatures("");
      refetch();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(buildId: string) {
    if (!confirm("Delete this project build and all its files?")) return;
    await api.projectBuilder.delete(buildId);
    refetch();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Project Builder</h1>
          <p className="text-muted text-sm mt-1">
            Generate complete software projects from a single idea. Multi-agent AI pipeline with planning, building, and validation.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          + New Project
        </button>
      </div>

      {/* Project Builds List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
              <div className="h-5 w-48 bg-card-border rounded mb-2" />
              <div className="h-4 w-72 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : data.builds.length === 0 ? (
        <EmptyState message="No projects yet. Click &quot;+ New Project&quot; to generate a complete software project from your idea." />
      ) : (
        <div className="space-y-3">
          {data.builds.map((build) => (
            <Link
              key={build.id}
              href={`/project-builder/${build.id}`}
              className="block rounded-xl border border-card-border bg-card-bg p-5 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {build.idea.length > 80 ? build.idea.slice(0, 80) + "..." : build.idea}
                  </h3>
                  <StatusBadge status={build.status} />
                  <PhaseBadge phase={build.current_phase} />
                </div>
                <div className="flex items-center gap-3">
                  <QualityBar score={build.quality_score} />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(build.id);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted">
                <span>Cycle {build.current_cycle}/{build.max_cycles}</span>
                <span>{build.total_files} files</span>
                {build.tech_stack && <span>{build.tech_stack}</span>}
                <span>{new Date(build.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Project Build">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Project Idea <span className="text-red-400">*</span>
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Build me a fitness tracking app with user accounts, workout logging, progress charts, and social features"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
            <p className="text-xs text-muted mt-1">
              Describe your project idea. The AI will expand it, design the architecture, and generate the code.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tech Stack</label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="Next.js + FastAPI + SQLite (optional)"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Target User</label>
            <input
              type="text"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              placeholder="Fitness enthusiasts, gym-goers (optional)"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Design Style</label>
            <input
              type="text"
              value={designStyle}
              onChange={(e) => setDesignStyle(e.target.value)}
              placeholder="Modern, dark mode, minimalist (optional)"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Key Features</label>
            <input
              type="text"
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="User auth, workout logging, progress charts (comma-separated, optional)"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-muted mt-1">
              Comma-separated list of features you want. AI will expand on these.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-card-border text-foreground hover:bg-card-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !idea.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Starting..." : "Build It"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
