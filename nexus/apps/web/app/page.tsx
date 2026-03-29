"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import DomainCard, { AddDomainCard } from "@/components/DomainCard";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import AddDomainModal from "@/components/AddDomainModal";
import { api } from "@/lib/api";
import { DEFAULT_DOMAINS } from "@/lib/domains";
import type { DomainData } from "@/lib/domains";

export default function HomePage() {
  const router = useRouter();
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.domains.list();
      if (response.success && response.data) {
        setDomains(
          response.data.map((d) => ({
            name: d.name,
            slug: d.slug,
            icon: d.icon || "\u{1F4E6}",
          }))
        );
      } else {
        // API returned an error response — surface it instead of hiding
        setError(response.error || "Failed to load domains");
      }
    } catch {
      // Network error — fall back to defaults so the UI is still usable
      setDomains(DEFAULT_DOMAINS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleDomainClick = (slug: string) => {
    router.push(`/${slug}`);
  };

  const handleAddDomain = (data: { name: string; icon: string }) => {
    const slug = data.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    // Optimistically add to local state
    setDomains((prev) => [...prev, { name: data.name, slug, icon: data.icon }]);

    // Fire API call with error handling
    api.domains.create({ name: data.name, icon: data.icon }).catch(() => {
      setDomains((prev) => prev.filter((d) => d.slug !== slug));
      setError("Failed to create domain");
    });
  };

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

  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to NEXUS
          </h1>
        </div>
        <ErrorState message={error} onRetry={fetchDomains} />
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
