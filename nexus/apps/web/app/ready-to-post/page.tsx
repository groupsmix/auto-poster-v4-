"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { toast } from "sonner";
import type { ReadyToPostProduct, ProductImage } from "@/lib/api";

/** Platform display config */
const PLATFORM_META: Record<string, { label: string; color: string; dimensions: string }> = {
  etsy: { label: "Etsy", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", dimensions: "1024x1024" },
  pinterest: { label: "Pinterest", color: "bg-red-500/10 text-red-400 border-red-500/20", dimensions: "1024x1536" },
  instagram: { label: "Instagram", color: "bg-pink-500/10 text-pink-400 border-pink-500/20", dimensions: "1024x1024" },
  twitter: { label: "Twitter/X", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", dimensions: "1536x864" },
  facebook: { label: "Facebook", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", dimensions: "1200x628" },
  gumroad: { label: "Gumroad", color: "bg-pink-600/10 text-pink-300 border-pink-600/20", dimensions: "1280x720" },
  shopify: { label: "Shopify", color: "bg-green-500/10 text-green-400 border-green-500/20", dimensions: "1024x1024" },
  thumbnail: { label: "Thumbnail", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", dimensions: "512x512" },
};

export default function ReadyToPostPage() {
  const { data: products, loading } = useApiQuery(
    () => api.readyToPost.list(),
    [] as ReadyToPostProduct[],
  );

  const [copiedState, setCopiedState] = useState<Record<string, string | null>>({});
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [postedPlatforms, setPostedPlatforms] = useState<Record<string, Set<string>>>({});

  const copyToClipboard = async (productId: string, key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState((prev) => ({ ...prev, [productId]: key }));
      toast.success("Copied to clipboard");
      setTimeout(() => {
        setCopiedState((prev) => ({ ...prev, [productId]: null }));
      }, 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const markAsPosted = (productId: string, platform: string) => {
    setPostedPlatforms((prev) => {
      const current = prev[productId] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return { ...prev, [productId]: next };
    });
  };

  const formatListingText = (variant: ReadyToPostProduct["platform_variants"][0]) => {
    return `${variant.title}\n\n${variant.description}\n\nPrice: $${variant.price.toFixed(2)}\nTags: ${variant.tags.join(", ")}`;
  };

  const getProductImages = (product: ReadyToPostProduct): Record<string, ProductImage> => {
    const imagesByPlatform: Record<string, ProductImage> = {};
    for (const img of product.images ?? []) {
      const platform = img.metadata?.platform ?? "thumbnail";
      imagesByPlatform[platform] = img;
    }
    return imagesByPlatform;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Ready to Post</h1>
        <p className="text-muted text-sm mt-1">
          Copy-paste ready content with platform-specific images for each product
        </p>
      </div>

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
                <div className="h-32 w-32 rounded bg-card-border" />
                <div className="h-32 w-32 rounded bg-card-border" />
                <div className="h-32 w-32 rounded bg-card-border" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
          <div className="text-4xl mb-3">🎨</div>
          <p className="text-muted text-sm">
            No approved products with images ready to post yet.
          </p>
          <p className="text-muted text-xs mt-2">
            Products will appear here after they pass CEO review.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {products.map((product) => {
            const imagesByPlatform = getProductImages(product);
            const isExpanded = expandedProduct === product.product_id;
            const posted = postedPlatforms[product.product_id] ?? new Set<string>();
            const allPlatforms = product.platform_variants.map((v) => v.platform);
            const postedCount = allPlatforms.filter((p) => posted.has(p)).length;

            return (
              <div
                key={product.product_id}
                className="rounded-xl border border-card-border bg-card-bg overflow-hidden"
              >
                {/* Product Header */}
                <button
                  onClick={() => setExpandedProduct(isExpanded ? null : product.product_id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-card-hover transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-base font-semibold text-foreground truncate">
                        {product.product_name}
                      </h2>
                      <span className="text-sm font-bold text-accent">
                        Score: {product.ai_score}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      {product.domain_name && <span>{product.domain_name}</span>}
                      {product.category_name && (
                        <>
                          <span className="text-card-border">|</span>
                          <span>{product.category_name}</span>
                        </>
                      )}
                      <span className="text-card-border">|</span>
                      <span>{product.platform_variants.length} platforms</span>
                      <span className="text-card-border">|</span>
                      <span>{(product.images ?? []).length} images</span>
                      {postedCount > 0 && (
                        <>
                          <span className="text-card-border">|</span>
                          <span className="text-green-400">{postedCount}/{allPlatforms.length} posted</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </span>
                </button>

                {/* Expanded Content — Platform Cards */}
                {isExpanded && (
                  <div className="border-t border-card-border">
                    {/* Image Gallery Overview */}
                    {(product.images ?? []).length > 0 && (
                      <div className="p-5 border-b border-card-border">
                        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                          Generated Images
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {(product.images ?? []).map((img) => {
                            const platform = img.metadata?.platform ?? "unknown";
                            const meta = PLATFORM_META[platform];
                            return (
                              <div key={img.id} className="relative group">
                                <div className="w-24 h-24 rounded-lg border border-card-border bg-card-hover overflow-hidden">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img.url}
                                    alt={`${platform} image`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                                <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium border ${meta?.color ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                                  {meta?.label ?? platform}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Platform-specific cards */}
                    <div className="p-5 space-y-4">
                      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Platform Listings
                      </h3>

                      {product.platform_variants.map((variant) => {
                        const platformImage = imagesByPlatform[variant.platform];
                        const meta = PLATFORM_META[variant.platform];
                        const isPosted = posted.has(variant.platform);

                        return (
                          <div
                            key={variant.platform}
                            className={`rounded-xl border p-4 transition-all ${
                              isPosted
                                ? "border-green-500/30 bg-green-500/5"
                                : "border-card-border bg-card-hover"
                            }`}
                          >
                            <div className="flex flex-col lg:flex-row gap-4">
                              {/* Platform Image */}
                              <div className="shrink-0">
                                {platformImage ? (
                                  <div className="w-full lg:w-40 h-40 rounded-lg border border-card-border overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={platformImage.url}
                                      alt={`${variant.platform} listing image`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full lg:w-40 h-40 rounded-lg border border-dashed border-card-border flex items-center justify-center">
                                    <span className="text-xs text-muted">No image</span>
                                  </div>
                                )}
                              </div>

                              {/* Listing Content */}
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${meta?.color ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                                      {meta?.label ?? variant.platform}
                                    </span>
                                    {meta?.dimensions && (
                                      <span className="text-xs text-muted">{meta.dimensions}</span>
                                    )}
                                    {isPosted && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                                        Posted
                                      </span>
                                    )}
                                    {variant.published_via === "auto" && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        Auto-Published
                                      </span>
                                    )}
                                    {variant.publish_error && !variant.external_url && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20" title={variant.publish_error}>
                                        Publish Failed
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => markAsPosted(product.product_id, variant.platform)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        isPosted
                                          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                          : "bg-card-bg border border-card-border text-muted hover:text-foreground"
                                      }`}
                                    >
                                      {isPosted ? "Unmark" : "Mark Posted"}
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <p className="text-sm font-medium text-foreground">{variant.title}</p>
                                  <p className="text-xs text-muted line-clamp-3">{variant.description}</p>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                                    <span className="font-medium text-foreground">${variant.price.toFixed(2)}</span>
                                    <span className="text-card-border">|</span>
                                    <span>{variant.tags.length} tags</span>
                                  </div>
                                  {variant.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {variant.tags.slice(0, 8).map((tag) => (
                                        <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-card-bg border border-card-border text-muted">
                                          {tag}
                                        </span>
                                      ))}
                                      {variant.tags.length > 8 && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] text-muted">
                                          +{variant.tags.length - 8} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* External link */}
                                {variant.external_url && (
                                  <a
                                    href={variant.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                    </svg>
                                    View on {meta?.label ?? variant.platform}
                                  </a>
                                )}

                                {/* Publish error details */}
                                {variant.publish_error && (
                                  <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">
                                    <span className="font-medium">Error:</span> {variant.publish_error}
                                  </div>
                                )}

                                {/* Copy button */}
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      product.product_id,
                                      variant.platform,
                                      formatListingText(variant)
                                    )
                                  }
                                  className={`mt-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                                    copiedState[product.product_id] === variant.platform
                                      ? "bg-green-500/10 text-green-400"
                                      : "bg-accent/10 text-accent hover:bg-accent/20"
                                  }`}
                                >
                                  {copiedState[product.product_id] === variant.platform
                                    ? "Copied!"
                                    : "Copy Listing to Clipboard"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Social Content */}
                    {product.social_variants.length > 0 && (
                      <div className="p-5 border-t border-card-border space-y-3">
                        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                          Social Media Posts
                        </h3>
                        {product.social_variants.map((social) => (
                          <div
                            key={social.channel}
                            className="rounded-lg border border-card-border bg-card-hover p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-foreground">{social.channel}</span>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    product.product_id,
                                    `social-${social.channel}`,
                                    `${social.caption}\n\n${social.hashtags.join(" ")}`
                                  )
                                }
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                                  copiedState[product.product_id] === `social-${social.channel}`
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-accent/10 text-accent hover:bg-accent/20"
                                }`}
                              >
                                {copiedState[product.product_id] === `social-${social.channel}`
                                  ? "Copied!"
                                  : "Copy"}
                              </button>
                            </div>
                            <p className="text-xs text-muted line-clamp-2">{social.caption}</p>
                            {social.hashtags.length > 0 && (
                              <p className="text-xs text-accent/60 mt-1 truncate">
                                {social.hashtags.join(" ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
