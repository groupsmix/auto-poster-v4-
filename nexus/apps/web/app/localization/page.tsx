"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { LocalizationJob, LanguageOption, LocalizationCandidate } from "@/lib/api";
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

export default function LocalizationPage() {
  const { data: jobs, loading: loadingJobs, error: errorJobs, refetch: refetchJobs } = useApiQuery(
    () => api.localization.jobs.list(),
    [],
  );
  const { data: languages, loading: loadingLang, error: errorLang, refetch: refetchLang } = useApiQuery(
    () => api.localization.languages(),
    [],
  );
  const { data: candidates, loading: loadingCandidates, error: errorCandidates, refetch: refetchCandidates } = useApiQuery(
    () => api.localization.candidates(10),
    [],
  );
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  function toggleLanguage(code: string) {
    setSelectedLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code]
    );
  }

  function selectAllLanguages() {
    if (selectedLanguages.length === (languages as LanguageOption[]).length) {
      setSelectedLanguages([]);
    } else {
      setSelectedLanguages((languages as LanguageOption[]).map((l) => l.code));
    }
  }

  async function handleCreate() {
    if (!selectedProduct || selectedLanguages.length === 0) return;
    setCreating(true);
    try {
      const result = await api.localization.jobs.create({
        source_product_id: selectedProduct,
        languages: selectedLanguages,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create localization job");
        return;
      }

      setShowCreate(false);
      setSelectedProduct("");
      setSelectedLanguages([]);
      refetchJobs();

      // Auto-execute localization
      if (result.data) {
        setExecuting(result.data.id);
        const execRes = await api.localization.jobs.execute(result.data.id);
        if (!execRes.success) {
          toast.error(execRes.error || "Failed to execute localization");
        }
        setExecuting(null);
        refetchJobs();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create localization job");
    } finally {
      setCreating(false);
    }
  }

  async function handleExecute(jobId: string) {
    setExecuting(jobId);
    try {
      const res = await api.localization.jobs.execute(jobId);
      if (!res.success) {
        toast.error(res.error || "Failed to execute localization");
      }
      refetchJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to execute localization");
    } finally {
      setExecuting(null);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm("Delete this localization job?")) return;
    try {
      const res = await api.localization.jobs.delete(jobId);
      if (!res.success) {
        toast.error(res.error || "Failed to delete localization job");
      }
      refetchJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete localization job");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Multi-Language Printer</h1>
          <p className="text-muted text-sm mt-1">
            Take winning English products and auto-create localized versions. Not just translated &mdash; properly localized.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          + New Localization Job
        </button>
      </div>

      {/* Supported Languages */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Supported Languages</h3>
        {errorLang ? (
          <ErrorState message={errorLang} onRetry={refetchLang} />
        ) : loadingLang ? (
          <div className="h-8 w-full bg-card-border rounded animate-pulse" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(languages as LanguageOption[]).map((lang) => (
              <span
                key={lang.code}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent"
                title={`${lang.marketplace_note} (${lang.currency})`}
              >
                {lang.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Localization Candidates */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Top English Products (Localization Candidates)</h3>
        {errorCandidates ? (
          <ErrorState message={errorCandidates} onRetry={refetchCandidates} />
        ) : loadingCandidates ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-card-border rounded animate-pulse" />
            ))}
          </div>
        ) : (candidates as LocalizationCandidate[]).length === 0 ? (
          <p className="text-sm text-muted">No English products with revenue data yet.</p>
        ) : (
          <div className="space-y-2">
            {(candidates as LocalizationCandidate[]).map((p, i) => (
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
                    Localize
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Localization Jobs */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Localization Jobs</h2>
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
        ) : (jobs as LocalizationJob[]).length === 0 ? (
          <EmptyState message="No localization jobs yet. Select a top-selling English product and localize it to multiple languages." />
        ) : (
          <div className="space-y-3">
            {(jobs as LocalizationJob[]).map((job) => (
              <div key={job.id} className="rounded-xl border border-card-border bg-card-bg p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-foreground">
                      {job.source_product_name ?? "Product"}
                    </span>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === "pending" && (
                      <button
                        onClick={() => handleExecute(job.id)}
                        disabled={executing === job.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {executing === job.id ? "Localizing..." : "Execute Localization"}
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
                  <span>Languages: {(job.languages_requested ?? []).length}</span>
                  {job.languages_completed && (
                    <span className="text-green-400">Completed: {job.languages_completed.length}</span>
                  )}
                  {job.languages_failed && job.languages_failed.length > 0 && (
                    <span className="text-red-400">Failed: {job.languages_failed.length}</span>
                  )}
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
                {job.languages_requested && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {job.languages_requested.map((lang) => {
                      const isCompleted = job.languages_completed?.includes(lang);
                      const isFailed = job.languages_failed?.includes(lang);
                      return (
                        <span
                          key={lang}
                          className={`text-xs px-2 py-0.5 rounded ${
                            isCompleted
                              ? "bg-green-500/10 text-green-400"
                              : isFailed
                                ? "bg-red-500/10 text-red-400"
                                : "bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {lang.toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Localization Job Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Localization Job">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Source Product ID</label>
            <input
              type="text"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              placeholder="Product ID of the English product to localize"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-foreground">Target Languages</label>
              <button
                onClick={selectAllLanguages}
                className="text-xs text-accent hover:underline"
              >
                {selectedLanguages.length === (languages as LanguageOption[]).length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(languages as LanguageOption[]).map((lang) => (
                <label
                  key={lang.code}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedLanguages.includes(lang.code)
                      ? "border-accent bg-accent/5"
                      : "border-card-border hover:bg-card-hover"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(lang.code)}
                    onChange={() => toggleLanguage(lang.code)}
                    className="rounded border-card-border"
                  />
                  <div>
                    <span className="text-sm text-foreground">{lang.name}</span>
                    <span className="text-xs text-muted block">{lang.currency}</span>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">
              Each language version includes: currency conversion, cultural adaptation, localized SEO keywords, and platform-specific formatting.
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
              disabled={creating || !selectedProduct || selectedLanguages.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : `Localize to ${selectedLanguages.length} language${selectedLanguages.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
