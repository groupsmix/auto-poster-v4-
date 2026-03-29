"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CategoryCard, { AddCategoryCard } from "@/components/CategoryCard";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { api } from "@/lib/api";
import { DEFAULT_DOMAINS, DEFAULT_CATEGORIES } from "@/lib/domains";
import type { CategoryData } from "@/lib/domains";

export default function DomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = use(params);
  const router = useRouter();

  const domainData = DEFAULT_DOMAINS.find((d) => d.slug === domain);
  const displayName = domainData?.name || domain.replace(/-/g, " ");

  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCategories = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.categories.list(domain);
        if (cancelled) return;
        if (response.success && response.data) {
          setCategories(
            response.data.map((c) => ({
              name: c.name,
              slug: c.slug,
            }))
          );
        } else {
          setCategories(DEFAULT_CATEGORIES[domain] || []);
        }
      } catch {
        if (!cancelled) {
          setCategories(DEFAULT_CATEGORIES[domain] || []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCategories();
    return () => {
      cancelled = true;
    };
  }, [domain]);

  const handleCategoryClick = (slug: string) => {
    router.push(`/${domain}/${slug}`);
  };

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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
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

      {loading ? (
        <LoadingState count={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.slug}
              name={cat.name}
              onClick={() => handleCategoryClick(cat.slug)}
            />
          ))}
          <AddCategoryCard />
        </div>
      )}
    </div>
  );
}
