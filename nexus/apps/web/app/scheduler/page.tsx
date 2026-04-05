"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { Domain } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        active
          ? "bg-green-500/10 text-green-400"
          : "bg-yellow-500/10 text-yellow-400"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-400" : "bg-yellow-400"}`}
      />
      {active ? "Active" : "Paused"}
    </span>
  );
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const absDiff = Math.abs(diffMs);
  const isPast = diffMs < 0;

  if (absDiff < 60000) return isPast ? "Just now" : "In < 1m";
  if (absDiff < 3600000) {
    const mins = Math.floor(absDiff / 60000);
    return isPast ? `${mins}m ago` : `In ${mins}m`;
  }
  if (absDiff < 86400000) {
    const hrs = Math.floor(absDiff / 3600000);
    return isPast ? `${hrs}h ago` : `In ${hrs}h`;
  }
  const days = Math.floor(absDiff / 86400000);
  return isPast ? `${days}d ago` : `In ${days}d`;
}

export default function SchedulerPage() {
  const { data: schedules, loading, refetch } = useApiQuery(
    () => api.schedules.list(),
    [],
  );
  const { data: domains } = useApiQuery(() => api.domains.list(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [ticking, setTicking] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formProductsPerRun, setFormProductsPerRun] = useState(5);
  const [formIntervalHours, setFormIntervalHours] = useState(24);
  const [formAutoApprove, setFormAutoApprove] = useState(9);
  const [formAutoReviseMin, setFormAutoReviseMin] = useState(7);

  async function handleCreate() {
    if (!formName || !formDomain) return;
    setCreating(true);
    try {
      await api.schedules.create({
        name: formName,
        domain_id: formDomain,
        products_per_run: formProductsPerRun,
        interval_hours: formIntervalHours,
        auto_approve_threshold: formAutoApprove,
        auto_revise_min_score: formAutoReviseMin,
        language: "en",
      });
      setShowCreate(false);
      setFormName("");
      setFormDomain("");
      refetch();
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string) {
    setToggling(id);
    try {
      await api.schedules.toggle(id);
      refetch();
    } finally {
      setToggling(null);
    }
  }

  async function handleTick() {
    setTicking(true);
    try {
      await api.schedules.tick();
      refetch();
    } finally {
      setTicking(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule?")) return;
    await api.schedules.delete(id);
    refetch();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scheduler</h1>
          <p className="text-muted text-sm mt-1">
            Set schedules to auto-create products 24/7
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTick}
            disabled={ticking}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-card-border text-foreground hover:bg-card-hover transition-colors disabled:opacity-50"
          >
            {ticking ? "Running..." : "Run Due Now"}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            + New Schedule
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse"
            >
              <div className="h-5 w-48 bg-card-border rounded mb-3" />
              <div className="h-4 w-32 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <EmptyState
          message="No schedules yet. Create one to start auto-producing products around the clock."
        />
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-card-border bg-card-bg p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {s.name}
                    </h3>
                    <StatusBadge active={s.is_active} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted">Products/Run</span>
                      <p className="font-medium text-foreground">
                        {s.products_per_run}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted">Interval</span>
                      <p className="font-medium text-foreground">
                        Every {s.interval_hours}h
                      </p>
                    </div>
                    <div>
                      <span className="text-muted">Last Run</span>
                      <p className="font-medium text-foreground">
                        {formatRelativeTime(s.last_run_at)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted">Next Run</span>
                      <p className="font-medium text-foreground">
                        {formatRelativeTime(s.next_run_at)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                    <span>Auto-approve: {s.auto_approve_threshold}+</span>
                    <span>Auto-revise: {s.auto_revise_min_score}-{s.auto_approve_threshold - 1}</span>
                    <span>Total created: {s.total_products_created}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggle(s.id)}
                    disabled={toggling === s.id}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      s.is_active
                        ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                        : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                    } disabled:opacity-50`}
                  >
                    {s.is_active ? "Pause" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Schedule Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Schedule">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Schedule Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Daily Real Estate Products"
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
                  Products per Run
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={formProductsPerRun}
                  onChange={(e) => setFormProductsPerRun(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Interval (hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={formIntervalHours}
                  onChange={(e) => setFormIntervalHours(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Auto-Approve Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formAutoApprove}
                  onChange={(e) => setFormAutoApprove(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Auto-Revise Min Score
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formAutoReviseMin}
                  onChange={(e) => setFormAutoReviseMin(Number(e.target.value))}
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
                {creating ? "Creating..." : "Create Schedule"}
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
