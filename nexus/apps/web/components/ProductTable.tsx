/**
 * ProductTable and SortHeader components (4.1).
 *
 * Extracted from products/page.tsx to reduce page file size
 * and improve reusability.
 */

import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { TrashIcon } from "@/components/icons/Icons";
import type { Product } from "@/lib/api";

export function SortHeader({
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
      aria-sort={active ? (currentDir === "asc" ? "ascending" : "descending") : "none"}
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

export default function ProductTable({
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
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-card-border text-left">
            {selectedIds && onToggleSelectAll && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && products.every((p) => selectedIds.has(p.id))}
                  onChange={onToggleSelectAll}
                  className="rounded border-card-border text-accent focus:ring-accent"
                  aria-label="Select all products"
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
                    aria-label={`Select ${product.name}`}
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
                  aria-label={`Delete ${product.name}`}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
