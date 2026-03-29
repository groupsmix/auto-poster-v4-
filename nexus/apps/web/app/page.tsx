"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import DomainCard, { AddDomainCard } from "@/components/DomainCard";
import LoadingState from "@/components/LoadingState";
import MockDataBanner from "@/components/MockDataBanner";
import AddDomainModal from "@/components/AddDomainModal";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { DEFAULT_DOMAINS } from "@/lib/domains";
import type { DomainData } from "@/lib/domains";
import type { Domain } from "@nexus/shared";

const MOCK_DOMAIN_API: Domain[] = DEFAULT_DOMAINS.map((d, i) => ({
  ...d,
  id: d.slug,
  description: "",
  sort_order: i,
  is_active: true,
  created_at: new Date().toISOString(),
}));

export default function HomePage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [localDomains, setLocalDomains] = useState<DomainData[]>([]);
  const [hasLocalOverride, setHasLocalOverride] = useState(false);

  const { data: apiDomains, loading, isUsingMock, refetch } = useApiQuery(
    () => api.domains.list(),
    MOCK_DOMAIN_API,
  );

  const domains: DomainData[] = useMemo(() => {
    if (hasLocalOverride) return localDomains;
    return apiDomains.map((d) => ({
      name: d.name,
      slug: d.slug,
      icon: d.icon || "\u{1F4E6}",
    }));
  }, [apiDomains, localDomains, hasLocalOverride]);

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

      api.domains.create({ name: data.name, icon: data.icon }).catch(() => {
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

      {isUsingMock && <MockDataBanner />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {domains.map((domain) => (
          <DomainCard
            key={domain.slug}
            name={domain.name}
            icon={domain.icon}
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
