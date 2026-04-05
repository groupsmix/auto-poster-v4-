"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { ABTest } from "@/lib/api";
import { SummaryCard, VariantBar } from "@/components/ui";

const AB_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-400",
  completed: "bg-blue-500/10 text-blue-400",
  cancelled: "bg-red-500/10 text-red-400",
};

function ABStatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${AB_STATUS_COLORS[status] ?? "bg-card-border text-muted"}`}>
      {status}
    </span>
  );
}

export default function ABTestingPage() {
  const { data: tests, loading, refetch } = useApiQuery(
    () => api.abTesting.list(),
    [] as ABTest[],
  );

  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  async function handleComplete(id: string) {
    if (!confirm("Mark this test as completed? The best variant will be selected as the winner.")) return;
    await api.abTesting.complete(id);
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this A/B test and all its variants?")) return;
    await api.abTesting.delete(id);
    refetch();
  }

  const activeTests = tests.filter((t) => t.status === "active");
  const completedTests = tests.filter((t) => t.status !== "active");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">A/B Testing</h1>
          <p className="text-muted text-sm mt-1">
            Test title/description variants to find what sells best
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Active Tests" value={activeTests.length} />
        <SummaryCard label="Completed Tests" value={completedTests.length} />
        <SummaryCard label="Total Tests" value={tests.length} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
              <div className="h-4 w-48 bg-card-border rounded mb-2" />
              <div className="h-3 w-72 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="text-muted">No A/B tests yet.</p>
          <p className="text-xs text-muted mt-1">
            A/B tests are created automatically when you generate variant listings for a product.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => {
            const isExpanded = expandedTest === test.id;
            const variants = test.variants ?? [];
            const maxConversion = Math.max(...variants.map((v) => v.conversion_rate), 1);

            return (
              <div key={test.id} className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                {/* Test Header */}
                <button
                  onClick={() => setExpandedTest(isExpanded ? null : test.id)}
                  className="w-full p-5 text-left hover:bg-card-border/20 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {test.product_name || test.product_id.slice(0, 8)}
                        </span>
                        <ABStatusBadge status={test.status} />
                        {test.winning_variant && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                            Winner: {test.winning_variant}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {variants.length} variants &middot; Started {new Date(test.started_at).toLocaleDateString()}
                        {test.ended_at && ` &middot; Ended ${new Date(test.ended_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Variant Details */}
                {isExpanded && (
                  <div className="border-t border-card-border p-5 space-y-4">
                    {/* Conversion Rate Comparison */}
                    <div>
                      <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Conversion Rate</h4>
                      <div className="space-y-2">
                        {variants.map((v) => (
                          <VariantBar
                            key={v.id}
                            label={v.variant_label}
                            value={v.conversion_rate}
                            maxValue={maxConversion}
                            color={v.variant_label === test.winning_variant ? "bg-accent" : "bg-card-border"}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Variant Details Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-card-border text-left">
                            <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Variant</th>
                            <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Title</th>
                            <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Views</th>
                            <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Clicks</th>
                            <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Sales</th>
                            <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Revenue</th>
                            <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Conv.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v) => (
                            <tr key={v.id} className="border-b border-card-border last:border-0">
                              <td className="py-2.5">
                                <span className={`font-bold ${v.variant_label === test.winning_variant ? "text-accent" : "text-foreground"}`}>
                                  {v.variant_label}
                                </span>
                              </td>
                              <td className="py-2.5 text-foreground max-w-[200px] truncate">{v.title}</td>
                              <td className="py-2.5 text-muted">{v.views}</td>
                              <td className="py-2.5 text-muted">{v.clicks}</td>
                              <td className="py-2.5 text-muted">{v.sales}</td>
                              <td className="py-2.5 text-muted font-mono">${v.revenue.toFixed(2)}</td>
                              <td className="py-2.5 text-muted">{v.conversion_rate.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                      {test.status === "active" && (
                        <button
                          onClick={() => handleComplete(test.id)}
                          className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:opacity-90"
                        >
                          Complete Test
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(test.id)}
                        className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:opacity-80"
                      >
                        Delete
                      </button>
                    </div>
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
