"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import { useApiQuery } from "@/lib/useApiQuery";
import { MOCK_PUBLISHABLE } from "@/lib/mock-data";
import { toast } from "sonner";
import type { PublishableProduct } from "@/lib/api";

interface ProductPublishState {
  selectedPlatforms: Record<string, boolean>;
  selectedChannels: Record<string, boolean>;
  copied: string | null;
  publishing: boolean;
}

export default function PublishPage() {
  const { data: products, loading, isUsingMock } = useApiQuery(
    () => api.publishing.ready(),
    MOCK_PUBLISHABLE,
  );

  const [publishStates, setPublishStates] = useState<
    Record<string, ProductPublishState>
  >({});
  const [exporting, setExporting] = useState(false);

  // Initialize publish states for each product
  useEffect(() => {
    const states: Record<string, ProductPublishState> = {};
    for (const p of products) {
      if (!publishStates[p.product_id]) {
        const platforms: Record<string, boolean> = {};
        for (const v of p.platform_variants) {
          platforms[v.platform] = true;
        }
        const channels: Record<string, boolean> = {};
        for (const v of p.social_variants) {
          channels[v.channel] = true;
        }
        states[p.product_id] = {
          selectedPlatforms: platforms,
          selectedChannels: channels,
          copied: null,
          publishing: false,
        };
      } else {
        states[p.product_id] = publishStates[p.product_id];
      }
    }
    if (Object.keys(states).length > 0) {
      setPublishStates(states);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const togglePlatform = (productId: string, platform: string) => {
    setPublishStates((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        selectedPlatforms: {
          ...prev[productId].selectedPlatforms,
          [platform]: !prev[productId].selectedPlatforms[platform],
        },
      },
    }));
  };

  const toggleChannel = (productId: string, channel: string) => {
    setPublishStates((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        selectedChannels: {
          ...prev[productId].selectedChannels,
          [channel]: !prev[productId].selectedChannels[channel],
        },
      },
    }));
  };

  const copyToClipboard = async (
    productId: string,
    platform: string,
    text: string
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setPublishStates((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], copied: platform },
      }));
      setTimeout(() => {
        setPublishStates((prev) => ({
          ...prev,
          [productId]: { ...prev[productId], copied: null },
        }));
      }, 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const handlePublish = async (product: PublishableProduct) => {
    const state = publishStates[product.product_id];
    if (!state) return;

    const platforms = Object.entries(state.selectedPlatforms)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const channels = Object.entries(state.selectedChannels)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setPublishStates((prev) => ({
      ...prev,
      [product.product_id]: { ...prev[product.product_id], publishing: true },
    }));

    try {
      await api.publishing.publish(product.product_id, {
        platforms,
        channels,
      });
    } catch {
      toast.error("Failed to publish. Please try again.");
    } finally {
      setPublishStates((prev) => ({
        ...prev,
        [product.product_id]: {
          ...prev[product.product_id],
          publishing: false,
        },
      }));
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    setExporting(true);
    try {
      const response = await api.publishing.export(format);
      if (response.success && response.data) {
        const blob = new Blob([response.data], {
          type: format === "json" ? "application/json" : "text/csv",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `listings-export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      setExporting(false);
    }
  };

  const formatListingText = (variant: PublishableProduct["platform_variants"][0]) => {
    return `${variant.title}\n\n${variant.description}\n\nPrice: $${variant.price.toFixed(2)}\nTags: ${variant.tags.join(", ")}`;
  };

  const copyAllListings = async (product: PublishableProduct) => {
    const allText = product.platform_variants
      .map(
        (v) =>
          `=== ${v.platform.toUpperCase()} ===\nTitle: ${v.title}\nDescription: ${v.description}\nPrice: $${v.price.toFixed(2)}\nTags: ${v.tags.join(", ")}`
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(allText);
      toast.success("All listings copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Publishing Center
          </h1>
          <p className="text-muted text-sm mt-1">
            Approved products ready to publish
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>

      {isUsingMock && <MockDataBanner />}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse"
            >
              <div className="h-6 w-64 rounded bg-card-border mb-4" />
              <div className="h-4 w-48 rounded bg-card-border mb-6" />
              <div className="flex gap-3">
                <div className="h-8 w-20 rounded bg-card-border" />
                <div className="h-8 w-20 rounded bg-card-border" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
          <p className="text-muted text-sm">
            No approved products ready to publish.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {products.map((product) => {
            const state = publishStates[product.product_id];
            if (!state) return null;
            const isManual = product.posting_mode === "manual";

            return (
              <div
                key={product.product_id}
                className="rounded-xl border border-card-border bg-card-bg overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b border-card-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        {product.product_name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                        {product.domain_name && (
                          <span>{product.domain_name}</span>
                        )}
                        {product.category_name && (
                          <>
                            <span className="text-card-border">|</span>
                            <span>{product.category_name}</span>
                          </>
                        )}
                        <span className="text-card-border">|</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            isManual
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-green-500/10 text-green-400"
                          }`}
                        >
                          {isManual ? "Manual" : "Auto"} Mode
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-accent">
                      Score: {product.ai_score}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Platform selection */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Platforms
                      </h3>
                      {isManual && product.platform_variants.length > 1 && (
                        <button
                          onClick={() => copyAllListings(product)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                        >
                          Copy All Listings
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {product.platform_variants.map((variant) => (
                        <div
                          key={variant.platform}
                          className="flex items-start gap-3 p-3 rounded-lg bg-card-hover"
                        >
                          <label className="flex items-center gap-2 cursor-pointer shrink-0 mt-0.5">
                            <input
                              type="checkbox"
                              checked={
                                state.selectedPlatforms[variant.platform] ??
                                false
                              }
                              onChange={() =>
                                togglePlatform(
                                  product.product_id,
                                  variant.platform
                                )
                              }
                              className="w-4 h-4 rounded border-card-border accent-accent"
                            />
                            <span className="text-sm font-medium text-foreground">
                              {variant.platform}
                            </span>
                          </label>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted truncate">
                              {variant.title}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              ${variant.price.toFixed(2)}
                            </p>
                          </div>
                          {isManual && (
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  product.product_id,
                                  variant.platform,
                                  formatListingText(variant)
                                )
                              }
                              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                state.copied === variant.platform
                                  ? "bg-green-500/10 text-green-400"
                                  : "bg-card-bg border border-card-border text-muted hover:text-foreground"
                              }`}
                            >
                              {state.copied === variant.platform
                                ? "Copied!"
                                : "Copy to Clipboard"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Social channel selection */}
                  {product.social_variants.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                        Social Channels
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {product.social_variants.map((variant) => (
                          <label
                            key={variant.channel}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card-hover cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={
                                state.selectedChannels[variant.channel] ?? false
                              }
                              onChange={() =>
                                toggleChannel(
                                  product.product_id,
                                  variant.channel
                                )
                              }
                              className="w-4 h-4 rounded border-card-border accent-accent"
                            />
                            <span className="text-sm text-foreground">
                              {variant.channel}
                            </span>
                            <span className="text-xs text-muted">
                              ({variant.post_type})
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Publish action */}
                  {!isManual && (
                    <div className="pt-2">
                      <button
                        onClick={() => handlePublish(product)}
                        disabled={state.publishing}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {state.publishing
                          ? "Publishing..."
                          : "Publish Now"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
