"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import MockDataBanner from "@/components/MockDataBanner";
import StatusBadge from "@/components/StatusBadge";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
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
  const { data: products, loading, isUsingMock } = useApiQuery(
    () => api.products.list(),
    MOCK_PRODUCTS,
  );
  const [localProducts, setLocalProducts] = useState<Product[] | null>(null);
  const [filterDomain, setFilterDomain] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterBatch, setFilterBatch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [batchView, setBatchView] = useState(false);
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
      // best-effort
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
          !p.name.toLowerCase().includes(q) &&
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
      try { await api.products.delete(id); } catch { /* best-effort */ }
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
          `"${p.name.replace(/"/g, '""')}"`,
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
      try { await api.post(`/workflow/retry/${id}`, {}); } catch { /* best-effort */ }
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

      {isUsingMock && <MockDataBanner />}

      {/* Filters */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent w-48"
            />
          </div>
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

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="text-muted text-sm">No products match your filters.</p>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-card-border bg-card-bg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete Product
            </h3>
            <p className="text-sm text-muted mb-6">
              This will permanently delete the product and trigger synced
              cleanup across all storage (D1, R2, KV, CF Images). This action
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey: colKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const active = currentSort === colKey;
  return (
    <th
      className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(colKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? "opacity-100" : "opacity-0"}`}>
          {currentDir === "asc" ? "\u2191" : "\u2193"}
        </span>
      </span>
    </th>
  );
}

function ProductTable({
  products,
  onDelete,
  formatDate,
  sortKey: currentSort = "",
  sortDir: currentDir = "desc",
  onSort,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: {
  products: Product[];
  onDelete: (id: string) => void;
  formatDate: (d: string) => string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}) {
  const handleSort = (key: string) => {
    onSort?.(key);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead>
          <tr className="border-b border-card-border text-left">
            {selectedIds && onToggleSelectAll && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && products.every((p) => selectedIds.has(p.id))}
                  onChange={onToggleSelectAll}
                  className="rounded border-card-border text-accent focus:ring-accent"
                />
              </th>
            )}
            <SortHeader label="Name" sortKey="name" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden md:table-cell">
              Domain
            </th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden lg:table-cell">
              Category
            </th>
            <SortHeader label="Status" sortKey="status" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden lg:table-cell">
              Platform(s)
            </th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden xl:table-cell">
              Batch
            </th>
            <SortHeader label="Created" sortKey="created_at" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors"
            >
              {selectedIds && onToggleSelect && (
                <td className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => onToggleSelect(product.id)}
                    className="rounded border-card-border text-accent focus:ring-accent"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <Link
                  href={`/products/${product.id}`}
                  className="font-medium text-foreground hover:text-accent transition-colors"
                >
                  {product.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted hidden md:table-cell">
                {product.domain_name ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted hidden lg:table-cell">
                {product.category_name ?? "—"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={product.status} />
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {(product.platforms ?? []).map((p) => (
                    <span
                      key={p}
                      className="text-xs px-1.5 py-0.5 rounded bg-card-hover text-muted"
                    >
                      {p}
                    </span>
                  ))}
                  {(!product.platforms || product.platforms.length === 0) && (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-muted text-xs hidden xl:table-cell">
                {product.batch_id ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted text-xs">
                {formatDate(product.created_at)}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onDelete(product.id)}
                  className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete product"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
