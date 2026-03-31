"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { handleApiError } from "@/lib/handleApiError";
import type { Domain } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import Modal from "@/components/Modal";

function CampaignStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-500/10 text-green-400",
    paused: "bg-yellow-500/10 text-yellow-400",
    completed: "bg-blue-500/10 text-blue-400",
    cancelled: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-gray-500/10 text-gray-400"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-card-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-accent" : "bg-yellow-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted whitespace-nowrap">
        {current}/{target} ({pct}%)
      </span>
    </div>
  );
}

export default function CampaignsPage() {
  const { data: campaigns, loading, error, refetch } = useApiQuery(
    () => api.campaigns.list(),
    [],
  );
  const { data: domains } = useApiQuery(() => api.domains.list(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formTarget, setFormTarget] = useState(100);
  const [formDeadline, setFormDeadline] = useState("");

  async function handleCreate() {
    if (!formName || !formDomain) return;
    setCreating(true);
    try {
      await api.campaigns.create({
        name: formName,
        domain_id: formDomain,
        target_count: formTarget,
        deadline: formDeadline || undefined,
        status: "active",
      });
      setShowCreate(false);
      setFormName("");
      setFormDomain("");
      setFormTarget(100);
      setFormDeadline("");
      refetch();
    } catch (err) {
      handleApiError(err, "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign?")) return;
    try {
      await api.campaigns.delete(id);
      refetch();
    } catch (err) {
      handleApiError(err, "Failed to delete campaign");
    }
  }

  function daysRemaining(deadline?: string): string {
    if (!deadline) return "No deadline";
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return "Past deadline";
    const days = Math.ceil(diff / 86400000);
    return `${days} day${days !== 1 ? "s" : ""} left`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted text-sm mt-1">
            Plan product campaigns with targets and deadlines
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse"
            >
              <div className="h-5 w-48 bg-card-border rounded mb-3" />
              <div className="h-4 w-full bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          message="No campaigns yet. Create one to set production targets and track progress."
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-card-border bg-card-bg p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {c.name}
                  </h3>
                  <CampaignStatusBadge status={c.status} />
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>

              <ProgressBar
                current={c.products_created}
                target={c.target_count}
              />

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4 text-sm">
                <div>
                  <span className="text-muted">Target</span>
                  <p className="font-medium text-foreground">
                    {c.target_count} products
                  </p>
                </div>
                <div>
                  <span className="text-muted">Created</span>
                  <p className="font-medium text-foreground">
                    {c.products_created}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Approved</span>
                  <p className="font-medium text-green-400">
                    {c.products_approved}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Published</span>
                  <p className="font-medium text-accent">
                    {c.products_published}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Deadline</span>
                  <p className="font-medium text-foreground">
                    {daysRemaining(c.deadline)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Campaign">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Campaign Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 200 Home Decor Products by April"
                className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Domain
              </label>
              <select
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select domain...</option>
                {domains.map((d: Domain) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Target Product Count
                </label>
                <input
                  type="number"
                  min={1}
                  value={formTarget}
                  onChange={(e) => setFormTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Deadline (optional)
                </label>
                <input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
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
                disabled={creating || !formName || !formDomain}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
