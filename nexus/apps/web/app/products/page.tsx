"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import MockDataBanner from "@/components/MockDataBanner";
import type { Product } from "@/lib/api";

// Mock data for when API is not available
const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-001",
    domain_id: "d1",
    category_id: "c1",
    name: "Freelancer CRM System — Notion Template",
    niche: "freelancers",
    language: "en",
    batch_id: "batch-001",
    status: "approved",
    created_at: "2025-03-15T10:30:00Z",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    platforms: ["Etsy", "Gumroad"],
  },
  {
    id: "prod-002",
    domain_id: "d1",
    category_id: "c1",
    name: "Student Planner — Notion Template",
    niche: "students",
    language: "en",
    batch_id: "batch-001",
    status: "pending_review",
    created_at: "2025-03-15T10:35:00Z",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    platforms: ["Etsy", "Gumroad", "Payhip"],
  },
  {
    id: "prod-003",
    domain_id: "d1",
    category_id: "c2",
    name: "Ultimate SEO Checklist — PDF Guide",
    niche: "marketers",
    language: "en",
    status: "published",
    created_at: "2025-03-10T08:00:00Z",
    domain_name: "Digital Products",
    category_name: "PDF Guides & Ebooks",
    platforms: ["Gumroad"],
  },
  {
    id: "prod-004",
    domain_id: "d2",
    category_id: "c3",
    name: "Minimalist Mountain T-Shirt Design",
    niche: "outdoor enthusiasts",
    language: "en",
    batch_id: "batch-002",
    status: "in_revision",
    created_at: "2025-03-12T14:00:00Z",
    domain_name: "Print on Demand (POD)",
    category_name: "T-Shirts & Apparel",
    platforms: ["Redbubble"],
  },
  {
    id: "prod-005",
    domain_id: "d2",
    category_id: "c3",
    name: "Retro Sunset Graphic Tee",
    niche: "retro lovers",
    language: "en",
    batch_id: "batch-002",
    status: "draft",
    created_at: "2025-03-12T14:05:00Z",
    domain_name: "Print on Demand (POD)",
    category_name: "T-Shirts & Apparel",
    platforms: ["Redbubble", "TeeSpring"],
  },
  {
    id: "prod-006",
    domain_id: "d3",
    category_id: "c4",
    name: "Podcast Launch Blueprint",
    niche: "content creators",
    language: "en",
    status: "approved",
    created_at: "2025-03-08T09:00:00Z",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    platforms: ["Gumroad", "Payhip"],
  },
  {
    id: "prod-007",
    domain_id: "d1",
    category_id: "c1",
    name: "Project Manager Dashboard — Notion",
    niche: "project managers",
    language: "en",
    batch_id: "batch-001",
    status: "running",
    created_at: "2025-03-15T10:40:00Z",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    platforms: ["Etsy"],
  },
];

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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-400",
    running: "bg-blue-500/10 text-blue-400",
    queued: "bg-gray-500/10 text-gray-400",
    pending_review: "bg-yellow-500/10 text-yellow-400",
    approved: "bg-green-500/10 text-green-400",
    in_revision: "bg-orange-500/10 text-orange-400",
    published: "bg-accent/10 text-accent",
    rejected: "bg-red-500/10 text-red-400",
    cancelled: "bg-gray-500/10 text-gray-500",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-gray-500/10 text-gray-400"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

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
  const [batchView, setBatchView] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    return effectiveProducts.filter((p) => {
      if (filterDomain && p.domain_name !== filterDomain) return false;
      if (filterCategory && p.category_name !== filterCategory) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterPlatform && !(p.platforms ?? []).includes(filterPlatform))
        return false;
      if (filterBatch && p.batch_id !== filterBatch) return false;
      return true;
    });
  }, [effectiveProducts, filterDomain, filterCategory, filterStatus, filterPlatform, filterBatch]);

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

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </p>
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

function ProductTable({
  products,
  onDelete,
  formatDate,
}: {
  products: Product[];
  onDelete: (id: string) => void;
  formatDate: (d: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-card-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
              Domain
            </th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
              Category
            </th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
              Platform(s)
            </th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
              Batch
            </th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
              Created
            </th>
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
              <td className="px-4 py-3">
                <Link
                  href={`/products/${product.id}`}
                  className="font-medium text-foreground hover:text-accent transition-colors"
                >
                  {product.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">
                {product.domain_name ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted">
                {product.category_name ?? "—"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={product.status} />
              </td>
              <td className="px-4 py-3">
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
              <td className="px-4 py-3 text-muted text-xs">
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
