"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { RecyclerJob, TopSellerProduct } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import Modal from "@/components/Modal";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400",
    running: "bg-blue-500/10 text-blue-400",
    completed: "bg-green-500/10 text-green-400",
    failed: "bg-red-500/10 text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-gray-500/10 text-gray-400"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StrategyBadge({ strategy }: { strategy: string }) {
  const labels: Record<string, string> = {
    angle: "Different Angle",
    bundle: "Bundle",
    seasonal: "Seasonal",
    regional: "Regional",
    all: "All Strategies",
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
      {labels[strategy] ?? strategy}
    </span>
  );
}

export default function RecyclerPage() {
  const { data: jobs, loading: loadingJobs, error: errorJobs, refetch: refetchJobs } = useApiQuery(
    () => api.recycler.jobs.list(),
    [],
  );
  const { data: topSellers, loading: loadingTop, error: errorTop, refetch: refetchTop } = useApiQuery(
    () => api.recycler.topSellers(10),
    [],
  );
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("all");
  const [variationsCount, setVariationsCount] = useState("10");

  async function handleCreate() {
    if (!selectedProduct) return;
    setCreating(true);
    try {
      const result = await api.recycler.jobs.create({
        source_product_id: selectedProduct,
        strategy: selectedStrategy,
        variations_requested: parseInt(variationsCount, 10),
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create recycler job");
        return;
      }

      setShowCreate(false);
      setSelectedProduct("");
      refetchJobs();

      // Auto-generate variations
      if (result.data) {
        setGenerating(result.data.id);
        const genRes = await api.recycler.jobs.generate(result.data.id);
        if (!genRes.success) {
          toast.error(genRes.error || "Failed to generate variations");
        }
        setGenerating(null);
        refetchJobs();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create recycler job");
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerate(jobId: string) {
    setGenerating(jobId);
    try {
      const res = await api.recycler.jobs.generate(jobId);
      if (!res.success) {
        toast.error(res.error || "Failed to generate variations");
      }
      refetchJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate variations");
    } finally {
      setGenerating(null);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm("Delete this recycler job?")) return;
    try {
      const res = await api.recycler.jobs.delete(jobId);
      if (!res.success) {
        toast.error(res.error || "Failed to delete recycler job");
      }
      refetchJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete recycler job");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Smart Product Recycler</h1>
          <p className="text-muted text-sm mt-1">
            Take winning products and auto-create 10 variations. Different angles, bundles, seasonal &amp; regional versions.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          + New Recycler Job
        </button>
      </div>

      {/* Top Sellers Section */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Top Selling Products (Recycler Candidates)</h3>
        {errorTop ? (
          <ErrorState message={errorTop} onRetry={refetchTop} />
        ) : loadingTop ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-card-border rounded animate-pulse" />
            ))}
          </div>
        ) : (topSellers as TopSellerProduct[]).length === 0 ? (
          <p className="text-sm text-muted">No revenue data yet. Connect platforms and sync revenue to see top sellers.</p>
        ) : (
          <div className="space-y-2">
            {(topSellers as TopSellerProduct[]).map((p, i) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted w-5">{i + 1}</span>
                  <div>
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <span className="text-xs text-muted ml-2">{p.domain_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-success">{formatCurrency(p.total_revenue)}</span>
                  <button
                    onClick={() => {
                      setSelectedProduct(p.id);
                      setShowCreate(true);
                    }}
                    className="px-3 py-1 text-xs font-medium rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
                  >
                    Recycle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recycler Jobs */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Recycler Jobs</h2>
        {errorJobs ? (
          <ErrorState message={errorJobs} onRetry={refetchJobs} />
        ) : loadingJobs ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
                <div className="h-5 w-32 bg-card-border rounded mb-2" />
                <div className="h-4 w-48 bg-card-border rounded" />
              </div>
            ))}
          </div>
        ) : (jobs as RecyclerJob[]).length === 0 ? (
          <EmptyState message="No recycler jobs yet. Select a top-selling product and create variations." />
        ) : (
          <div className="space-y-3">
            {(jobs as RecyclerJob[]).map((job) => (
              <div key={job.id} className="rounded-xl border border-card-border bg-card-bg p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-foreground">
                      {job.source_product_name ?? "Product"}
                    </span>
                    <StatusBadge status={job.status} />
                    <StrategyBadge strategy={job.strategy} />
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === "pending" && (
                      <button
                        onClick={() => handleGenerate(job.id)}
                        disabled={generating === job.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {generating === job.id ? "Generating..." : "Generate Variations"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-muted">
                  <span>Requested: {job.variations_requested}</span>
                  <span>Created: {job.variations_created}</span>
                  <span>Approved: {job.variations_approved}</span>
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
                {job.analysis && (
                  <div className="mt-3 p-3 rounded-lg bg-background">
                    <p className="text-xs font-medium text-muted mb-1">Analysis: Why it sells</p>
                    <div className="flex flex-wrap gap-1">
                      {job.analysis.why_it_sells?.map((reason, i) => (
                        <span key={i} className="text-xs text-foreground bg-card-bg px-2 py-0.5 rounded">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Recycler Job Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Recycler Job">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Source Product ID</label>
            <input
              type="text"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              placeholder="Product ID of the winner to recycle"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Strategy</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Strategies</option>
              <option value="angle">Different Angle</option>
              <option value="bundle">Bundle Products</option>
              <option value="seasonal">Seasonal Versions</option>
              <option value="regional">Regional Versions</option>
            </select>
            <p className="text-xs text-muted mt-1">
              &quot;All&quot; generates a mix of angle, bundle, seasonal, and regional variations.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Number of Variations</label>
            <input
              type="number"
              min="1"
              max="50"
              value={variationsCount}
              onChange={(e) => setVariationsCount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
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
              disabled={creating || !selectedProduct}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create & Generate"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
