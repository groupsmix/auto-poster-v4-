"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { formatDateTime } from "@/lib/format";
import type { Product } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import PlatformVariantPreview from "@/components/PlatformVariantPreview";
import SocialVariantPreview from "@/components/SocialVariantPreview";
import type { PlatformVariant } from "@/components/PlatformVariantPreview";
import type { SocialVariant } from "@/components/SocialVariantPreview";
import { toast } from "sonner";
import AppImage from "@/components/AppImage";

interface ProductDetail extends Product {
  description?: string;
  platform_variants?: PlatformVariant[];
  social_variants?: SocialVariant[];
  assets?: { id: string; asset_type: string; url: string; r2_key: string }[];
  reviews?: {
    id: string;
    version: number;
    ai_score: number;
    ai_model: string;
    decision?: string;
    feedback?: string;
    reviewed_at: string;
  }[];
}

export default function ProductDetailPageClient({ id }: { id: string }) {
  const { data: product, loading, error } = useApiQuery<ProductDetail | null>(
    () => api.products.get(id) as Promise<{ success: boolean; data?: ProductDetail | null; error?: string }>,
    null,
    [id],
  );

  const [activePlatformTab, setActivePlatformTab] = useState(0);
  const [activeSocialTab, setActiveSocialTab] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      const response = await api.products.delete(id);
      if (response.success) {
        toast.success("Product deleted");
        router.push("/products");
      } else {
        toast.error(response.error || "Failed to delete product. Please try again.");
      }
    } catch {
      toast.error("Failed to delete product. Please try again.");
    }
  };


  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse"
          >
            <div className="h-5 w-48 rounded bg-card-border mb-3" />
            <div className="h-4 w-full rounded bg-card-border mb-2" />
            <div className="h-4 w-3/4 rounded bg-card-border" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {error ? "Failed to load product" : "Product not found"}
        </h3>
        <p className="text-muted text-sm text-center max-w-md mb-4">
          {error || "The product you're looking for doesn't exist or has been deleted."}
        </p>
        <Link
          href="/products"
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Back to Products
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/products" className="hover:text-foreground transition-colors">
          Products
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{product.name}</span>
      </div>

      {/* Back + Title */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="p-2 rounded-lg border border-card-border hover:bg-card-hover transition-colors shrink-0"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {product.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <StatusBadge status={product.status} />
              {product.domain_name && (
                <span className="text-xs text-muted">{product.domain_name}</span>
              )}
              {product.category_name && (
                <>
                  <span className="text-xs text-card-border">|</span>
                  <span className="text-xs text-muted">{product.category_name}</span>
                </>
              )}
              {product.batch_id && (
                <>
                  <span className="text-xs text-card-border">|</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                    {product.batch_id}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDeleteConfirm(true)}
          className="shrink-0 px-4 py-2 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-600/20 transition-colors"
        >
          Delete Product
        </button>
      </div>

      <div className="space-y-6">
        {/* Product info */}
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Product Details
          </h2>
          {product.description && (
            <p className="text-sm text-foreground/80 mb-4">
              {product.description}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted block mb-1">Niche</span>
              <span className="text-foreground">{product.niche}</span>
            </div>
            <div>
              <span className="text-xs text-muted block mb-1">Language</span>
              <span className="text-foreground">{product.language}</span>
            </div>
            <div>
              <span className="text-xs text-muted block mb-1">Created</span>
              <span className="text-foreground">
                {formatDateTime(product.created_at)}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted block mb-1">Platforms</span>
              <div className="flex flex-wrap gap-1">
                {(product.platforms ?? []).map((p) => (
                  <span
                    key={p}
                    className="text-xs px-1.5 py-0.5 rounded bg-card-hover text-muted"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Platform Variants */}
        {product.platform_variants && product.platform_variants.length > 0 && (
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Platform Variants
            </h2>
            <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Platform variants">
              {product.platform_variants.map((v, i) => (
                <button
                  key={v.platform}
                  role="tab"
                  aria-selected={activePlatformTab === i}
                  onClick={() => setActivePlatformTab(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activePlatformTab === i
                      ? "bg-accent text-white"
                      : "bg-card-hover text-muted hover:text-foreground"
                  }`}
                >
                  {v.platform}
                </button>
              ))}
            </div>
            <PlatformVariantPreview
              variant={product.platform_variants[activePlatformTab]}
            />
          </div>
        )}

        {/* Social Variants */}
        {product.social_variants && product.social_variants.length > 0 && (
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Social Variants
            </h2>
            <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Social variants">
              {product.social_variants.map((v, i) => (
                <button
                  key={v.channel}
                  role="tab"
                  aria-selected={activeSocialTab === i}
                  onClick={() => setActiveSocialTab(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeSocialTab === i
                      ? "bg-accent text-white"
                      : "bg-card-hover text-muted hover:text-foreground"
                  }`}
                >
                  {v.channel}
                </button>
              ))}
            </div>
            <SocialVariantPreview
              variant={product.social_variants[activeSocialTab]}
            />
          </div>
        )}

        {/* Assets */}
        {product.assets && product.assets.length > 0 && (
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Assets
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {product.assets.map((asset) => (
                <a
                  key={asset.id}
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-video rounded-lg bg-card-hover border border-card-border overflow-hidden hover:border-accent/30 transition-all block"
                >
                  {asset.asset_type === "image" || asset.asset_type === "mockup" ? (
                    <AppImage
                      src={asset.url}
                      alt={asset.r2_key.split("/").pop()}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted text-xs uppercase">
                      {asset.asset_type}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Review History */}
        {product.reviews && product.reviews.length > 0 && (
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Review History
            </h2>
            <div className="space-y-3">
              {product.reviews.map((review) => {
                const scoreColor =
                  review.ai_score >= 8
                    ? "text-green-400"
                    : review.ai_score >= 6
                      ? "text-yellow-400"
                      : "text-red-400";
                return (
                  <div
                    key={review.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card-hover"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-bold ${scoreColor}`}
                      >
                        {review.ai_score}
                      </span>
                      <div>
                        <span className="text-sm text-foreground">
                          v{review.version}
                        </span>
                        <span className="text-xs text-muted ml-2">
                          {review.ai_model}
                        </span>
                      </div>
                      {review.decision && (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            review.decision === "approved"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {review.decision}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted">
                      {formatDateTime(review.reviewed_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete Product"
        maxWidth="sm"
      >
        <p className="text-sm text-muted mb-6">
          This will permanently delete the product and trigger synced
          cleanup across all storage (D1, R2, KV, CF Images). This action
          cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteConfirm(false)}
            className="flex-1 px-4 py-2 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
