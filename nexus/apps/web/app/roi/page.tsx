"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { ROIDashboard } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function ROIBadge({ roi }: { roi: number }) {
  let color = "bg-gray-500/10 text-gray-400";
  if (roi >= 5) color = "bg-green-500/10 text-green-400";
  else if (roi >= 2) color = "bg-blue-500/10 text-blue-400";
  else if (roi >= 1) color = "bg-yellow-500/10 text-yellow-400";
  else if (roi > 0) color = "bg-red-500/10 text-red-400";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {roi}x ROI
    </span>
  );
}

const emptyDashboard: ROIDashboard = {
  snapshots: [],
  top_niches: [],
  worst_niches: [],
  total_revenue: 0,
  total_cost: 0,
  overall_roi: 0,
};

export default function ROIPage() {
  const { data: dashboard, loading } = useApiQuery(
    () => api.roi.dashboard(),
    emptyDashboard,
  );
  const [showAddCost, setShowAddCost] = useState(false);
  const [adding, setAdding] = useState(false);

  // Form state
  const [formDomainId, setFormDomainId] = useState("");
  const [formNiche, setFormNiche] = useState("");
  const [formCostType, setFormCostType] = useState("ai_api");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");

  async function handleAddCost() {
    if (!formDomainId || !formAmount) return;
    setAdding(true);
    try {
      await api.roi.costs.add({
        domain_id: formDomainId,
        niche: formNiche || undefined,
        cost_type: formCostType,
        amount: parseFloat(formAmount),
        description: formDescription || undefined,
      });
      setShowAddCost(false);
      setFormDomainId("");
      setFormNiche("");
      setFormAmount("");
      setFormDescription("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ROI Optimizer</h1>
          <p className="text-muted text-sm mt-1">
            Track costs, revenue, and ROI per niche. Kill losers, double down on winners.
          </p>
        </div>
        <button
          onClick={() => setShowAddCost(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          + Add Cost
        </button>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
              <div className="h-4 w-24 bg-card-border rounded mb-3" />
              <div className="h-8 w-20 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Revenue</p>
            <p className="text-2xl font-bold text-success mt-1">{formatCurrency(dashboard.total_revenue)}</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Cost</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(dashboard.total_cost)}</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Overall ROI</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              <ROIBadge roi={dashboard.overall_roi} />
            </p>
          </div>
        </div>
      )}

      {/* Top Niches (Winners) */}
      {dashboard.top_niches.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            Top Performing Niches
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Niche</th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Revenue</th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Cost</th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">ROI</th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Products</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.top_niches.map((n, i) => (
                  <tr key={i} className="border-b border-card-border last:border-0">
                    <td className="py-2.5 font-medium text-foreground">{n.niche ?? "Unknown"}</td>
                    <td className="py-2.5 text-right text-success font-semibold">{formatCurrency(n.revenue)}</td>
                    <td className="py-2.5 text-right text-muted">{formatCurrency(n.cost)}</td>
                    <td className="py-2.5 text-right"><ROIBadge roi={n.roi_multiplier} /></td>
                    <td className="py-2.5 text-right text-muted">{n.products_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Worst Niches (Losers) */}
      {dashboard.worst_niches.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-400 rounded-full" />
            Underperforming Niches
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Niche</th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Revenue</th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Cost</th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">ROI</th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.worst_niches.map((n, i) => (
                  <tr key={i} className="border-b border-card-border last:border-0">
                    <td className="py-2.5 font-medium text-foreground">{n.niche ?? "Unknown"}</td>
                    <td className="py-2.5 text-right text-muted">{formatCurrency(n.revenue)}</td>
                    <td className="py-2.5 text-right text-red-400 font-semibold">{formatCurrency(n.cost)}</td>
                    <td className="py-2.5 text-right"><ROIBadge roi={n.roi_multiplier} /></td>
                    <td className="py-2.5 text-right">
                      <span className="text-xs text-red-400">Consider stopping</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Latest Report Recommendations */}
      {dashboard.latest_report && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Latest Report Recommendations</h3>
          <div className="space-y-2">
            {(dashboard.latest_report.recommendations ?? []).map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background">
                <span className="text-accent mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                </span>
                <p className="text-sm text-foreground">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROI Snapshots */}
      {dashboard.snapshots.length > 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent ROI Snapshots</h3>
          <div className="space-y-2">
            {dashboard.snapshots.slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
                <div>
                  <span className="text-sm font-medium text-foreground">{s.niche ?? "All"}</span>
                  <span className="text-xs text-muted ml-2">{s.period}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted">{formatCurrency(s.total_revenue)} rev</span>
                  <ROIBadge roi={s.roi_multiplier} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !loading ? (
        <EmptyState message="No ROI data yet. Add costs and generate snapshots to start tracking ROI by niche." />
      ) : null}

      {/* Add Cost Modal */}
      <Modal isOpen={showAddCost} onClose={() => setShowAddCost(false)} title="Add Niche Cost">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Domain ID</label>
            <input
              type="text"
              value={formDomainId}
              onChange={(e) => setFormDomainId(e.target.value)}
              placeholder="e.g. domain-123"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Niche</label>
            <input
              type="text"
              value={formNiche}
              onChange={(e) => setFormNiche(e.target.value)}
              placeholder="e.g. Dog Toys"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Cost Type</label>
            <select
              value={formCostType}
              onChange={(e) => setFormCostType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="ai_api">AI API Cost</option>
              <option value="time">Time Investment</option>
              <option value="platform_fee">Platform Fee</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAddCost(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-card-border text-foreground hover:bg-card-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCost}
              disabled={adding || !formDomainId || !formAmount}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add Cost"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
