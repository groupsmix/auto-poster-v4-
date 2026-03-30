"use client";

import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import Modal from "@/components/Modal";
import ProductTable from "@/components/ProductTable";
import { SearchIcon } from "@/components/icons/Icons";
import { formatDate as sharedFormatDate } from "@/lib/format";
import { toast } from "sonner";
import type { Product } from "@/lib/api";


const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "running", label: "Running" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "in_revision", label: "In Revision" },
  { value: "published", label: "Published" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ProductsPage() {
  const { data: products, loading } = useApiQuery(
    () => api.products.list(),
    [],
  );
  const [localProducts, setLocalProducts] = useState<Product[] | null>(null);
  const [filterDomain, setFilterDomain] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterBatch, setFilterBatch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [batchView, setBatchView] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "status" | "created_at" | "">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Bulk actions state (5.8)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const effectiveProducts = localProducts ?? products;

  const handleDelete = async (id: string) => {
    try {
      await api.products.delete(id);
    } catch {
      toast.error("Failed to delete product");
    }
    setLocalProducts((prev) => (prev ?? products).filter((p) => p.id !== id));
    setDeleteConfirm(null);
  };

  // Derive unique filter options from products
  const domains = useMemo(
    () => [...new Set(effectiveProducts.map((p) => p.domain_name).filter(Boolean))],
    [effectiveProducts]
  );
  const categories = useMemo(
    () => [...new Set(effectiveProducts.map((p) => p.category_name).filter(Boolean))],
    [effectiveProducts]
  );
  const platformsList = useMemo(
    () => [...new Set(effectiveProducts.flatMap((p) => p.platforms ?? []))],
    [effectiveProducts]
  );
  const batches = useMemo(
    () => [...new Set(effectiveProducts.map((p) => p.batch_id).filter(Boolean))],
    [effectiveProducts]
  );

  // Filter products
  const filtered = useMemo(() => {
    let result = effectiveProducts.filter((p) => {
      if (filterDomain && p.domain_name !== filterDomain) return false;
      if (filterCategory && p.category_name !== filterCategory) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterPlatform && !(p.platforms ?? []).includes(filterPlatform))
        return false;
      if (filterBatch && p.batch_id !== filterBatch) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !(p.name ?? "").toLowerCase().includes(q) &&
          !(p.niche ?? "").toLowerCase().includes(q) &&
          !(p.domain_name ?? "").toLowerCase().includes(q) &&
          !(p.category_name ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [effectiveProducts, filterDomain, filterCategory, filterStatus, filterPlatform, filterBatch, searchQuery, sortKey, sortDir]);

  // Group by batch
  const batchGroups = useMemo(() => {
    if (!batchView) return null;
    const groups: Record<string, Product[]> = {};
    const ungrouped: Product[] = [];
    for (const p of filtered) {
      if (p.batch_id) {
        if (!groups[p.batch_id]) groups[p.batch_id] = [];
        groups[p.batch_id].push(p);
      } else {
        ungrouped.push(p);
      }
    }
    return { groups, ungrouped };
  }, [filtered, batchView]);

  const formatDate = sharedFormatDate;

  // Bulk action handlers (5.8)
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try { await api.products.delete(id); } catch { toast.error(`Failed to delete product ${id}`); }
    }
    setLocalProducts((prev) => (prev ?? products).filter((p) => !selectedIds.has(p.id)));
    toast.success(`Deleted ${ids.length} product${ids.length > 1 ? "s" : ""}`);
    setSelectedIds(new Set());
  };

  const handleBulkExport = () => {
    const items = filtered.filter((p) => selectedIds.has(p.id));
    const csv = [
      ["ID", "Name", "Status", "Domain", "Category", "Platforms", "Created"].join(","),
      ...items.map((p) =>
        [
          p.id,
          `"${(p.name ?? "").replace(/"/g, '""')}"`,
          p.status,
          p.domain_name ?? "",
          p.category_name ?? "",
          (p.platforms ?? []).join(";"),
          p.created_at,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-products-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${items.length} product${items.length > 1 ? "s" : ""}`);
  };

  const handleBulkRetry = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try { await api.post(`/workflow/retry/${id}`, {}); } catch { toast.error(`Failed to retry product ${id}`); }
    }
    toast.success(`Retried ${ids.length} product${ids.length > 1 ? "s" : ""}`);
    setSelectedIds(new Set());
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Products</h1>
        <p className="text-muted text-sm mt-1">
          All products with status and filtering
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4 mb-6">
        {/* Row 1: Search + Status + More filters toggle + Batch view */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search products..."
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
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              showMoreFilters || filterDomain || filterCategory || filterPlatform || filterBatch
                ? "border-accent/50 text-accent bg-accent/5"
                : "border-card-border text-muted hover:text-foreground bg-card-hover"
            }`}
            aria-expanded={showMoreFilters}
          >
            {(() => {
              const count = [filterDomain, filterCategory, filterPlatform, filterBatch].filter(Boolean).length;
              return count > 0 ? `More filters (${count})` : "More filters";
            })()}
          </button>

          {(filterDomain || filterCategory || filterPlatform || filterBatch || filterStatus) && (
            <button
              onClick={() => {
                setFilterDomain("");
                setFilterCategory("");
                setFilterStatus("");
                setFilterPlatform("");
                setFilterBatch("");
                setSearchQuery("");
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              Clear all
            </button>
          )}

          {/* Batch view toggle */}
          <button
            onClick={() => setBatchView(!batchView)}
            className={`ml-auto px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              batchView
                ? "bg-accent text-white"
                : "bg-card-hover text-muted hover:text-foreground border border-card-border"
            }`}
          >
            {batchView ? "Batch View" : "Flat List"}
          </button>
        </div>

        {/* Row 2: Additional filters (collapsible) */}
        {showMoreFilters && (
          <div className="flex flex-wrap gap-3 items-center mt-3 pt-3 border-t border-card-border">
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">All Domains</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">All Platforms</option>
              {platformsList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Results count + Bulk actions bar (5.8) */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          {selectedIds.size > 0 && (
            <span className="ml-2 text-accent font-medium">
              ({selectedIds.size} selected)
            </span>
          )}
        </p>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkRetry}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleBulkExport}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        )}
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
      ) : batchView && batchGroups ? (
        <div className="space-y-6">
          {/* Batched groups */}
          {Object.entries(batchGroups.groups).map(([batchId, batchProducts]) => (
            <div key={batchId}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-xs font-semibold">
                  BATCH
                </span>
                <span className="text-sm font-medium text-foreground">
                  {batchId}
                </span>
                <span className="text-xs text-muted">
                  ({batchProducts.length} products)
                </span>
              </div>
              <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                  <ProductTable
                    products={batchProducts}
                    onDelete={(id) => setDeleteConfirm(id)}
                    formatDate={formatDate}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={(key) => {
                      if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else { setSortKey(key as "name" | "status" | "created_at"); setSortDir("asc"); }
                    }}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                  />
              </div>
            </div>
          ))}

          {/* Ungrouped */}
          {batchGroups.ungrouped.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-muted">
                  No Batch
                </span>
                <span className="text-xs text-muted">
                  ({batchGroups.ungrouped.length} products)
                </span>
              </div>
              <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                  <ProductTable
                    products={batchGroups.ungrouped}
                    onDelete={(id) => setDeleteConfirm(id)}
                    formatDate={formatDate}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={(key) => {
                      if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else { setSortKey(key as "name" | "status" | "created_at"); setSortDir("asc"); }
                    }}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                  />
              </div>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-sm">No products match your filters.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
          <ProductTable
            products={filtered}
            onDelete={(id) => setDeleteConfirm(id)}
            formatDate={formatDate}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(key) => {
              if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
              else { setSortKey(key as "name" | "status" | "created_at"); setSortDir("asc"); }
            }}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Product"
        maxWidth="sm"
      >
        <p className="text-sm text-muted mb-6">
          This will permanently delete the product and trigger synced
          cleanup across all storage (D1, R2, KV, CF Images). This action
          cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="flex-1 px-4 py-2 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
