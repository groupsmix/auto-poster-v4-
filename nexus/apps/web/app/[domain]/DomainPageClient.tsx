"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CategoryCard, { AddCategoryCard } from "@/components/CategoryCard";
import AddCategoryModal from "@/components/AddCategoryModal";
import LoadingState from "@/components/LoadingState";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { handleApiError } from "@/lib/handleApiError";
import { DEFAULT_DOMAINS, DEFAULT_CATEGORIES } from "@/lib/domains";
import type { CategoryData } from "@/lib/domains";
import { ArrowLeftIcon } from "@/components/icons/Icons";

export default function DomainPageClient({ domain }: { domain: string }) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [localCategories, setLocalCategories] = useState<CategoryData[]>([]);
  const [hasLocalOverride, setHasLocalOverride] = useState(false);

  const domainData = DEFAULT_DOMAINS.find((d) => d.slug === domain);
  const displayName = domainData?.name || domain.replace(/-/g, " ");

  const { data: apiCategories, loading, error } = useApiQuery(
    () => api.categories.list(domain).then((response) => ({
      success: response.success,
      data: response.success && response.data
        ? response.data.map((c: { name: string; slug: string }) => ({ name: c.name, slug: c.slug }))
        : undefined,
      error: response.error,
    })),
    DEFAULT_CATEGORIES[domain] || [],
    [domain],
  );

  const categories = hasLocalOverride ? localCategories : apiCategories;

  const handleCategoryClick = (slug: string) => {
    router.push(`/${domain}/${slug}`);
  };

  const handleAddCategory = useCallback(
    async (data: { name: string }) => {
      const slug = data.name
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .trim();

      const res = await api.categories.create(domain, { name: data.name });

      if (!res.success) {
        const message = res.error || "Failed to create category";
        handleApiError(new Error(message), message);
        throw new Error(message);
      }

      const updated = [...categories, { name: data.name, slug }];
      setLocalCategories(updated);
      setHasLocalOverride(true);
    },
    [categories, domain],
  );

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">{displayName}</span>
      </div>

      {/* Back button + Title */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
          className="p-2 rounded-lg border border-card-border hover:bg-card-hover transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {domainData?.icon && (
              <span className="mr-2">{domainData.icon}</span>
            )}
            {displayName}
          </h1>
          <p className="text-muted text-sm mt-0.5">
            Select a category to create a product
          </p>
        </div>
      </div>

      {/* Show inline warning when API is unreachable but we have fallback data */}
      {error && !loading && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-600/10 px-4 py-2.5 mb-4 flex items-center gap-2 text-sm text-yellow-300">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>Showing default categories — API unavailable</span>
        </div>
      )}

      {loading ? (
        <LoadingState count={8} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.slug}
              name={cat.name}
              onClick={() => handleCategoryClick(cat.slug)}
            />
          ))}
          <AddCategoryCard onClick={() => setShowAddModal(true)} />
        </div>
      )}

      <AddCategoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddCategory}
      />
    </div>
  );
}
