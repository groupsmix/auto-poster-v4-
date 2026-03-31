"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import DomainCard, { AddDomainCard } from "@/components/DomainCard";
import LoadingState from "@/components/LoadingState";
import AddDomainModal from "@/components/AddDomainModal";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { handleApiError } from "@/lib/handleApiError";
import { DEFAULT_CATEGORIES } from "@/lib/domains";
import type { DomainData } from "@/lib/domains";
import type { Domain } from "@nexus/shared";

export default function HomePage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [localDomains, setLocalDomains] = useState<DomainData[]>([]);
  const [hasLocalOverride, setHasLocalOverride] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() =>
    typeof window !== "undefined" ? !localStorage.getItem("nexus_onboarding_dismissed") : false
  );

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("nexus_onboarding_dismissed", "1");
  };

  const { data: apiDomains, loading, refetch } = useApiQuery(
    () => api.domains.list(),
    [] as Domain[],
  );

  const domains: DomainData[] = useMemo(() => {
    if (hasLocalOverride) return localDomains;
    return apiDomains.map((d) => ({
      name: d.name,
      slug: d.slug,
      icon: d.icon || "\u{1F4E6}",
    }));
  }, [apiDomains, localDomains, hasLocalOverride]);

  // Build subtitle for each domain card showing category & product counts
  const domainSubtitles = useMemo(() => {
    const subtitles: Record<string, string> = {};
    for (const d of domains) {
      const catCount = (DEFAULT_CATEGORIES[d.slug] ?? []).length;
      const parts: string[] = [];
      if (catCount > 0) parts.push(`${catCount} categories`);
      subtitles[d.slug] = parts.join(" \u00B7 ") || "No activity yet";
    }
    return subtitles;
  }, [domains]);

  const handleDomainClick = useCallback(
    (slug: string) => {
      router.push(`/${slug}`);
    },
    [router],
  );

  const handleAddDomain = useCallback(
    (data: { name: string; icon: string }) => {
      const slug = data.name
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .trim();

      const updated = [...domains, { name: data.name, slug, icon: data.icon }];
      setLocalDomains(updated);
      setHasLocalOverride(true);

      api.domains.create({ name: data.name, icon: data.icon }).catch((err) => {
        handleApiError(err, "Failed to create domain");
        setLocalDomains((prev) => prev.filter((d) => d.slug !== slug));
        refetch();
      });
    },
    [domains, refetch],
  );

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to NEXUS
          </h1>
          <p className="text-muted text-sm mt-1">
            Select a domain to get started
          </p>
        </div>
        <LoadingState count={10} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome to NEXUS
        </h1>
        <p className="text-muted text-sm mt-1">
          Select a domain to get started
        </p>
      </div>

      {showOnboarding && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">How NEXUS works</h2>
              <ol className="text-sm text-muted space-y-1 list-decimal list-inside">
                <li><span className="text-foreground">Pick a domain</span> — choose a product niche below</li>
                <li><span className="text-foreground">Choose a category</span> — narrow down the product type</li>
                <li><span className="text-foreground">Configure your product</span> — fill in details or let AI generate them</li>
                <li><span className="text-foreground">AI generates everything</span> — title, description, images, SEO</li>
                <li><span className="text-foreground">CEO Review</span> — approve, edit, or reject before publishing</li>
                <li><span className="text-foreground">Publish</span> — push to Etsy, Gumroad, and social channels</li>
              </ol>
            </div>
            <button
              onClick={dismissOnboarding}
              className="shrink-0 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
              aria-label="Dismiss onboarding guide"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {domains.map((domain) => (
          <DomainCard
            key={domain.slug}
            name={domain.name}
            icon={domain.icon}
            subtitle={domainSubtitles[domain.slug]}
            onClick={() => handleDomainClick(domain.slug)}
          />
        ))}
        <AddDomainCard onClick={() => setShowAddModal(true)} />
      </div>

      <AddDomainModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddDomain}
      />
    </div>
  );
}
