"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useReviewCounts } from "@/lib/ReviewCountContext";
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

// Mock data for when API is not available
const MOCK_REVIEW: ReviewData = {
  id: "review-demo",
  product_name: "Freelancer CRM System — Notion Template",
  description:
    "A comprehensive Notion template designed for freelancers to manage clients, track invoices, and organize projects. Features automated workflows, client pipeline views, and financial dashboards that help solo entrepreneurs stay on top of their business operations.",
  ai_score: 8.4,
  ai_model: "DeepSeek-V3",
  ai_health: 94,
  ai_status: "active",
  cache_hits: 3,
  total_cost: 0.012,
  tokens_used: 12450,
  platform_variants: [
    {
      platform: "Etsy",
      title: "Freelancer CRM Notion Template | Client Tracker & Invoice Manager",
      description:
        "Stay organized with this all-in-one Freelancer CRM Notion template. Track clients, manage invoices, and visualize your pipeline — all in one beautiful workspace.",
      tags: ["notion template", "freelancer", "crm", "client tracker", "invoice", "business"],
      price: 19.99,
      scores: { seo: 9, title: 8, tags: 8 },
    },
    {
      platform: "Gumroad",
      title: "The Ultimate Freelancer CRM — Notion Template Pack",
      description:
        "Everything you need to manage your freelance business. Client management, invoicing, project tracking, and beautiful dashboards — all inside Notion.",
      tags: ["notion", "freelance", "crm", "productivity", "template"],
      price: 24.99,
      scores: { seo: 8, title: 9, tags: 7 },
    },
    {
      platform: "Payhip",
      title: "Freelancer CRM System for Notion",
      description:
        "Streamline your freelance workflow with this comprehensive CRM template for Notion. Manage clients, invoices, and projects effortlessly.",
      tags: ["notion", "freelancer", "crm", "template", "business tool"],
      price: 17.99,
      scores: { seo: 7, title: 8, tags: 8 },
    },
  ],
  social_variants: [
    {
      channel: "Instagram",
      caption:
        "Stop losing clients in your DMs. This Freelancer CRM Notion template tracks everything — clients, invoices, projects — so you can focus on what matters: your craft.",
      hashtags: ["freelancer", "notiontemplate", "crm", "productivity", "solopreneur"],
      post_type: "Carousel",
    },
    {
      channel: "TikTok",
      caption:
        "POV: You finally organize your freelance business with ONE Notion template. Client tracker, invoice manager, project dashboard — all in one place.",
      hashtags: ["freelancertips", "notionsetup", "productivityhack", "freelancelife"],
      post_type: "Short Video",
    },
    {
      channel: "X/Twitter",
      caption:
        "Built a Notion CRM template for freelancers.\n\nIt tracks:\n- Clients & leads\n- Invoices & payments\n- Projects & deadlines\n\nAll in one workspace. Link in bio.",
      hashtags: ["notion", "freelance", "buildinpublic"],
      post_type: "Thread",
    },
  ],
  images: [],
};

export default function ReviewScreen({ productId }: ReviewScreenProps) {
  const router = useRouter();
  const { refetch: refreshCounts } = useReviewCounts();
  const [review, setReview] = useState<ReviewData>(MOCK_REVIEW);
  const [activePlatformTab, setActivePlatformTab] = useState(0);
  const [activeSocialTab, setActiveSocialTab] = useState(0);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchReview = async () => {
      try {
        const response = await api.get<ReviewData>(`/reviews/${productId}`);
        if (!cancelled && response.success && response.data) {
          setReview(response.data);
        }
        } catch {
          toast.error("Failed to load review data");
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
      await api.post(`/reviews/${productId}/approve`, {});
      toast.success("Product approved — sending to publish");
      refreshCounts();
      router.push("/publish");
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
      await api.post(`/reviews/${productId}/reject`, { feedback });
      toast.success("Rejected — sending back to AI with feedback");
      refreshCounts();
      router.push(`/workflow/${productId}`);
    } catch {
      toast.error("Failed to reject — please try again");
    } finally {
      setSubmitting(false);
    }
  };

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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
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
