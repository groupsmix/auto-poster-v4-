"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ReviewItem } from "@/lib/api";

// Mock data for when API is not available
const MOCK_PENDING: ReviewItem[] = [
  {
    id: "rev-001",
    product_id: "prod-002",
    product_name: "Student Planner — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    ai_score: 8.7,
    ai_model: "DeepSeek-V3",
    version: 1,
    reviewed_at: "2025-03-15T11:00:00Z",
    status: "pending_review",
  },
  {
    id: "rev-002",
    product_id: "prod-008",
    product_name: "Fitness Coaching Plan — PDF",
    domain_name: "Knowledge & Education",
    category_name: "Coaching Plans",
    ai_score: 7.9,
    ai_model: "Qwen 3.5 Max",
    version: 1,
    reviewed_at: "2025-03-14T16:30:00Z",
    status: "pending_review",
  },
  {
    id: "rev-003",
    product_id: "prod-009",
    product_name: "SaaS Landing Page Template",
    domain_name: "Digital Products",
    category_name: "SaaS Templates",
    ai_score: 9.1,
    ai_model: "DeepSeek-R1",
    version: 1,
    reviewed_at: "2025-03-14T14:00:00Z",
    status: "pending_review",
  },
];

const MOCK_IN_REVISION: ReviewItem[] = [
  {
    id: "rev-004",
    product_id: "prod-004",
    product_name: "Minimalist Mountain T-Shirt Design",
    domain_name: "Print on Demand (POD)",
    category_name: "T-Shirts & Apparel",
    ai_score: 6.5,
    ai_model: "DeepSeek-V3",
    decision: "rejected",
    feedback: "Design needs more contrast and the text is too small for print",
    version: 2,
    reviewed_at: "2025-03-13T10:00:00Z",
    status: "in_revision",
  },
];

const MOCK_HISTORY: ReviewItem[] = [
  {
    id: "rev-005",
    product_id: "prod-001",
    product_name: "Freelancer CRM System — Notion Template",
    domain_name: "Digital Products",
    category_name: "Notion Templates",
    ai_score: 8.4,
    ai_model: "DeepSeek-V3",
    decision: "approved",
    version: 1,
    reviewed_at: "2025-03-15T12:00:00Z",
    status: "approved",
  },
  {
    id: "rev-006",
    product_id: "prod-003",
    product_name: "Ultimate SEO Checklist — PDF Guide",
    domain_name: "Digital Products",
    category_name: "PDF Guides & Ebooks",
    ai_score: 9.2,
    ai_model: "DeepSeek-R1",
    decision: "approved",
    version: 1,
    reviewed_at: "2025-03-10T10:00:00Z",
    status: "approved",
  },
  {
    id: "rev-007",
    product_id: "prod-006",
    product_name: "Podcast Launch Blueprint",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    ai_score: 7.8,
    ai_model: "Qwen 3.5 Max",
    decision: "rejected",
    feedback: "Title too generic, needs more specificity",
    version: 1,
    reviewed_at: "2025-03-08T11:00:00Z",
    status: "rejected",
  },
  {
    id: "rev-008",
    product_id: "prod-006",
    product_name: "Podcast Launch Blueprint",
    domain_name: "Content & Media",
    category_name: "Podcast Content",
    ai_score: 8.9,
    ai_model: "DeepSeek-V3",
    decision: "approved",
    version: 2,
    reviewed_at: "2025-03-08T14:00:00Z",
    status: "approved",
  },
];

type Tab = "pending" | "in_revision" | "history";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "text-green-400 bg-green-500/10"
      : score >= 6
        ? "text-yellow-400 bg-yellow-500/10"
        : "text-red-400 bg-red-500/10";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function DecisionBadge({ decision }: { decision?: string }) {
  if (!decision) return null;
  const colors: Record<string, string> = {
    approved: "bg-green-500/10 text-green-400",
    rejected: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[decision] ?? "bg-gray-500/10 text-gray-400"}`}
    >
      {decision}
    </span>
  );
}

export default function ReviewCenterPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<ReviewItem[]>([]);
  const [inRevision, setInRevision] = useState<ReviewItem[]>([]);
  const [history, setHistory] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, revisionRes, historyRes] = await Promise.all([
        api.reviews.pending(),
        api.reviews.inRevision(),
        api.reviews.history(),
      ]);
      setPending(
        pendingRes.success && pendingRes.data ? pendingRes.data : MOCK_PENDING
      );
      setInRevision(
        revisionRes.success && revisionRes.data
          ? revisionRes.data
          : MOCK_IN_REVISION
      );
      setHistory(
        historyRes.success && historyRes.data ? historyRes.data : MOCK_HISTORY
      );
    } catch {
      setPending(MOCK_PENDING);
      setInRevision(MOCK_IN_REVISION);
      setHistory(MOCK_HISTORY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: "Pending Review", count: pending.length },
    { key: "in_revision", label: "In Revision", count: inRevision.length },
    { key: "history", label: "Review History", count: history.length },
  ];

  const activeItems =
    activeTab === "pending"
      ? pending
      : activeTab === "in_revision"
        ? inRevision
        : history;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Review Center</h1>
        <p className="text-muted text-sm mt-1">
          CEO approval queue and revision history
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-accent text-white"
                : "bg-card-hover text-muted hover:text-foreground border border-card-border"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : tab.key === "pending"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-card-border text-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse"
            >
              <div className="flex gap-4">
                <div className="h-5 w-48 rounded bg-card-border" />
                <div className="h-5 w-16 rounded bg-card-border" />
                <div className="h-5 w-20 rounded bg-card-border" />
              </div>
            </div>
          ))}
        </div>
      ) : activeItems.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
          <p className="text-muted text-sm">
            {activeTab === "pending"
              ? "No products waiting for review."
              : activeTab === "in_revision"
                ? "No products currently being revised."
                : "No review history yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeItems.map((item) => (
            <Link
              key={item.id}
              href={`/review/${item.product_id}`}
              className="block rounded-xl border border-card-border bg-card-bg p-5 hover:bg-card-hover hover:border-accent/30 transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate">
                      {item.product_name}
                    </h3>
                    <ScoreBadge score={item.ai_score} />
                    {item.decision && (
                      <DecisionBadge decision={item.decision} />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {item.domain_name && <span>{item.domain_name}</span>}
                    {item.category_name && (
                      <>
                        <span className="text-card-border">|</span>
                        <span>{item.category_name}</span>
                      </>
                    )}
                    <span className="text-card-border">|</span>
                    <span>v{item.version}</span>
                    <span className="text-card-border">|</span>
                    <span>{item.ai_model}</span>
                  </div>
                  {item.feedback && (
                    <p className="text-xs text-muted mt-2 line-clamp-1 italic">
                      Feedback: &quot;{item.feedback}&quot;
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted whitespace-nowrap">
                    {formatDate(item.reviewed_at)}
                  </span>
                  <span className="text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all">
                    &rarr;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
