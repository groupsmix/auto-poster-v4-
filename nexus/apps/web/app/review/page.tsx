"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import { useApiQuery } from "@/lib/useApiQuery";
import { ScoreBadge, DecisionBadge } from "@/components/StatusBadge";
import { MOCK_PENDING, MOCK_IN_REVISION, MOCK_REVIEW_HISTORY } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";

type Tab = "pending" | "in_revision" | "history";

export default function ReviewCenterPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pending");

  const { data: pending, loading: loadingPending, isUsingMock: mockPending } = useApiQuery(
    () => api.reviews.pending(),
    MOCK_PENDING,
  );
  const { data: inRevision, loading: loadingRevision, isUsingMock: mockRevision } = useApiQuery(
    () => api.reviews.inRevision(),
    MOCK_IN_REVISION,
  );
  const { data: history, loading: loadingHistory, isUsingMock: mockHistory } = useApiQuery(
    () => api.reviews.history(),
    MOCK_REVIEW_HISTORY,
  );

  const loading = loadingPending || loadingRevision || loadingHistory;
  const isUsingMock = mockPending || mockRevision || mockHistory;


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

      {isUsingMock && <MockDataBanner />}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Review tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
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
                    {formatDateTime(item.reviewed_at)}
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
