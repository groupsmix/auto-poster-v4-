"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useReviewCounts } from "@/lib/ReviewCountContext";
import AppImage from "@/components/AppImage";
import AIStatusBadge from "./AIStatusBadge";
import AIHealthBar from "./AIHealthBar";
import CacheIndicator from "./CacheIndicator";
import PlatformVariantPreview from "./PlatformVariantPreview";
import SocialVariantPreview from "./SocialVariantPreview";
import type { PlatformVariant } from "./PlatformVariantPreview";
import type { SocialVariant } from "./SocialVariantPreview";

interface ReviewData {
  id: string;
  product_name: string;
  description: string;
  ai_score: number;
  ai_model: string;
  ai_health: number;
  ai_status: string;
  cache_hits: number;
  total_cost: number;
  tokens_used: number;
  platform_variants: PlatformVariant[];
  social_variants: SocialVariant[];
  images: string[];
}

interface ReviewScreenProps {
  productId: string;
}

const FEEDBACK_PROMPTS = [
  "Title too generic, make it more niche-specific",
  "Description sounds robotic in paragraph 2",
  "Price too low, raise to $27",
  "Tags need more long-tail keywords",
  "Social captions need more personality",
];


export default function ReviewScreen({ productId }: ReviewScreenProps) {
  const router = useRouter();
  const { refetch: refreshCounts } = useReviewCounts();
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState(0);
  const [activeSocialTab, setActiveSocialTab] = useState(0);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchReview = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.reviews.get(productId) as { success: boolean; data?: ReviewData; error?: string };
        if (!cancelled) {
          if (response.success && response.data) {
            setReview(response.data);
          } else {
            setError(response.error || "Failed to load review data");
          }
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load review data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchReview();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const response = await api.post(`/reviews/${productId}/approve`, {});
      if (response.success) {
        toast.success("Product approved — sending to publish");
        refreshCounts();
        router.push("/publish");
      } else {
        toast.error(response.error || "Failed to approve — please try again");
      }
    } catch {
      toast.error("Failed to approve — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      const response = await api.post(`/reviews/${productId}/reject`, { feedback });
      if (response.success) {
        toast.success("Rejected — sending back to AI with feedback");
        refreshCounts();
        router.push(`/workflow/${productId}`);
      } else {
        toast.error(response.error || "Failed to reject — please try again");
      }
    } catch {
      toast.error("Failed to reject — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse">
            <div className="h-5 w-48 rounded bg-card-border mb-3" />
            <div className="h-4 w-full rounded bg-card-border mb-2" />
            <div className="h-4 w-3/4 rounded bg-card-border" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load review</h3>
        <p className="text-muted text-sm text-center max-w-md mb-4">{error || "Review data not found"}</p>
        <button
          onClick={() => router.push("/review")}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Back to Review Center
        </button>
      </div>
    );
  }

  const scoreColor =
    review.ai_score >= 8
      ? "text-green-400"
      : review.ai_score >= 6
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <div className="space-y-6">
      {/* AI Score Header */}
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Score circle */}
            <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-card-border">
              <span className={`text-2xl font-bold ${scoreColor}`}>
                {review.ai_score}
              </span>
              <span className="text-[10px] text-muted">/10</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {review.product_name}
              </h2>
              <p className="text-sm text-muted mt-0.5">
                {review.ai_score >= 7
                  ? "Ready for review"
                  : "Needs attention — score below threshold"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <AIStatusBadge status={review.ai_status as import("@nexus/shared").AIModelStatus} />
            </div>
            <CacheIndicator hit={review.cache_hits > 0} />
            <span className="px-2 py-0.5 rounded bg-card-hover text-muted">
              Cost: ${review.total_cost.toFixed(4)}
            </span>
            <span className="px-2 py-0.5 rounded bg-card-hover text-muted">
              {review.tokens_used.toLocaleString()} tokens
            </span>
          </div>
        </div>
        <div className="mt-4">
          <AIHealthBar score={review.ai_health} name={review.ai_model} />
        </div>
      </div>

      {/* Description Preview */}
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Description Preview
          </h3>
          <button
            onClick={() => setDescExpanded(!descExpanded)}
            className="text-xs text-accent hover:underline"
          >
            {descExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
        <p
          className={`text-sm text-foreground/80 ${
            descExpanded ? "" : "line-clamp-3"
          }`}
        >
          {review.description}
        </p>
      </div>

      {/* Platform Variants */}
      {review.platform_variants.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Platform Variants
          </h3>
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Platform variants">
            {review.platform_variants.map((v, i) => (
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
          {/* Active variant preview */}
          <PlatformVariantPreview
            variant={review.platform_variants[activePlatformTab]}
          />
        </div>
      )}

      {/* Social Content */}
      {review.social_variants.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Social Content
          </h3>
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Social variants">
            {review.social_variants.map((v, i) => (
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
          {/* Active variant preview */}
          <SocialVariantPreview
            variant={review.social_variants[activeSocialTab]}
          />
        </div>
      )}

      {/* Image Previews */}
      {review.images.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Generated Images
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {review.images.map((img, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg bg-card-hover border border-card-border overflow-hidden"
              >
                <AppImage
                  src={img}
                  alt={`Generated image ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        {!showRejectForm ? (
          <div className="flex gap-3">
            <button
              data-action="approve"
              onClick={handleApprove}
              disabled={submitting}
              className="flex-1 px-6 py-3 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Publishing..." : "APPROVE — SEND TO PUBLISH"}
            </button>
            <button
              data-action="reject"
              onClick={() => setShowRejectForm(true)}
              disabled={submitting}
              className="flex-1 px-6 py-3 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-600/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              REJECT
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">
              Rejection Feedback
            </h4>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell AI what to fix..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-card-hover border border-card-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-accent resize-none"
            />
            {/* Quick feedback suggestions */}
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() =>
                    setFeedback((prev) =>
                      prev ? `${prev}\n${prompt}` : prompt
                    )
                  }
                  className="text-xs px-2.5 py-1 rounded-lg bg-card-hover text-muted hover:text-foreground hover:bg-accent/10 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={submitting || !feedback.trim()}
                className="flex-1 px-6 py-3 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Sending..."
                  : "SEND BACK TO AI WITH FEEDBACK"}
              </button>
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setFeedback("");
                }}
                className="px-6 py-3 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
