"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import CategoryCard, { AddCategoryCard } from "@/components/CategoryCard";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { DEFAULT_DOMAINS, DEFAULT_CATEGORIES } from "@/lib/domains";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import DomainIcon from "@/components/icons/DomainIcon";

export default function DomainPageClient({ domain }: { domain: string }) {
  const router = useRouter();

  const domainData = DEFAULT_DOMAINS.find((d) => d.slug === domain);
  const displayName = domainData?.name || domain.replace(/-/g, " ");

  const { data: categories, loading, error } = useApiQuery(
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
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {domainData?.icon && (
              <span className="text-accent">
                <DomainIcon slug={domainData.icon} className="w-7 h-7" />
              </span>
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
      ) : categories.length === 0 && error ? (
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
