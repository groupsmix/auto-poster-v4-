"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { Bundle } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-400",
  active: "bg-green-500/10 text-green-400",
  archived: "bg-card-border text-muted",
};

export default function BundlesPage() {
  const { data: bundles, loading, refetch } = useApiQuery(
    () => api.bundles.list(),
    [] as Bundle[],
  );

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoGrouping, setAutoGrouping] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    await api.bundles.create({ name, description: description || undefined });
    setName("");
    setDescription("");
    setShowForm(false);
    setSaving(false);
    refetch();
  }

  async function handleAutoGroup() {
    if (!confirm("Auto-group published products into bundles by niche? This will create draft bundles.")) return;
    setAutoGrouping(true);
    const res = await api.bundles.autoGroup({ min_items: 3, price_multiplier: 2.5 });
    setAutoGrouping(false);
    if (res.success && res.data) {
      alert(`Created ${res.data.bundles_created} bundles!`);
    }
    refetch();
  }

  async function handleStatusChange(id: string, status: string) {
    await api.bundles.update(id, { status } as Partial<Bundle>);
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this bundle and remove all items?")) return;
    await api.bundles.delete(id);
    refetch();
  }

  const draftBundles = bundles.filter((b) => b.status === "draft");
  const activeBundles = bundles.filter((b) => b.status === "active");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bundle Creator</h1>
          <p className="text-muted text-sm mt-1">
            Group related products into bundles — sell at 2-3x individual price
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoGroup}
            disabled={autoGrouping}
            className="px-4 py-2 bg-card-border text-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {autoGrouping ? "Grouping..." : "Auto-Group"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            {showForm ? "Cancel" : "+ New Bundle"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Active Bundles</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activeBundles.length}</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Draft Bundles</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{draftBundles.length}</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Bundles</p>
          <p className="text-2xl font-bold text-foreground mt-1">{bundles.length}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">New Bundle</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Bundle Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
                placeholder="Complete Student Planner Pack"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
                placeholder="All planners a student needs in one pack"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Bundle"}
          </button>
        </div>
      )}

      {/* Bundle List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
              <div className="h-4 w-48 bg-card-border rounded mb-2" />
              <div className="h-3 w-72 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : bundles.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="text-muted">No bundles yet.</p>
          <p className="text-xs text-muted mt-1">
            Create bundles manually or use Auto-Group to automatically bundle related products.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="rounded-xl border border-card-border bg-card-bg p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{bundle.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[bundle.status] ?? "bg-card-border text-muted"}`}>
                      {bundle.status}
                    </span>
                  </div>
                  {bundle.description && (
                    <p className="text-xs text-muted mt-1">{bundle.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                    <span>{bundle.item_count ?? 0} items</span>
                    {bundle.individual_total > 0 && (
                      <span>Individual: ${bundle.individual_total.toFixed(2)}</span>
                    )}
                    {bundle.bundle_price != null && (
                      <span className="text-accent font-bold">Bundle: ${bundle.bundle_price.toFixed(2)}</span>
                    )}
                    {bundle.savings_pct > 0 && (
                      <span className="text-green-400">{bundle.savings_pct.toFixed(0)}% savings</span>
                    )}
                    {bundle.domain_name && <span>Domain: {bundle.domain_name}</span>}
                    {bundle.category_name && <span>Category: {bundle.category_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {bundle.status === "draft" && (
                    <button
                      onClick={() => handleStatusChange(bundle.id, "active")}
                      className="px-3 py-1.5 text-xs bg-green-500/10 text-green-400 rounded-lg hover:opacity-80"
                    >
                      Activate
                    </button>
                  )}
                  {bundle.status === "active" && (
                    <button
                      onClick={() => handleStatusChange(bundle.id, "archived")}
                      className="px-3 py-1.5 text-xs bg-card-border text-muted rounded-lg hover:opacity-80"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(bundle.id)}
                    className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:opacity-80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
