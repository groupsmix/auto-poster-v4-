"use client";

import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { AnalyticsDashboard } from "@/lib/api";
import AnalyticsCharts from "@/components/AnalyticsCharts";

function SummaryCard({
  label,
  value,
  subValue,
  subLabel,
  icon,
}: {
  label: string;
  value: string | number;
  subValue?: string | number;
  subLabel?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {subValue !== undefined && (
            <p className="text-xs text-muted mt-1">
              {subLabel}: <span className="text-foreground">{subValue}</span>
            </p>
          )}
        </div>
        <div className="text-muted">{icon}</div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export default function AnalyticsPage() {
  // Single dashboard query instead of 7 separate API calls (5.4)
  const emptyDashboard: AnalyticsDashboard = {
    summary: { total_products_all_time: 0, total_products_this_month: 0, total_ai_calls_all_time: 0, total_ai_calls_this_month: 0, cache_hit_rate: 0, total_cost: 0, avg_workflow_time_ms: 0, cost_savings: 0 },
    aiUsage: [], costBreakdown: [], cacheHitTrend: [], productsByDomain: [], productsByCategory: [], leaderboard: [],
  };
  const { data: dashboard, loading } = useApiQuery(
    () => api.analytics.dashboard(),
    emptyDashboard,
  );

  const { summary, aiUsage, costBreakdown, cacheHitTrend, productsByDomain, productsByCategory, leaderboard } = dashboard;

  // Sort leaderboard by health_score desc, then total_calls desc
  const sortedLeaderboard = [...leaderboard].sort(
    (a, b) => b.health_score - a.health_score || b.total_calls - a.total_calls
  );

  // Most used models ranked by total calls
  const mostUsedModels = [...leaderboard].sort(
    (a, b) => b.total_calls - a.total_calls
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted text-sm mt-1">
          Usage charts, cache hit rates, AI leaderboard, and cost breakdown
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse"
              >
                <div className="h-4 w-24 bg-card-border rounded mb-3" />
                <div className="h-8 w-16 bg-card-border rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-card-border bg-card-bg p-5 h-72 animate-pulse"
              >
                <div className="h-4 w-40 bg-card-border rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Products"
              value={summary.total_products_all_time}
              subValue={summary.total_products_this_month}
              subLabel="This month"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              }
            />
            <SummaryCard
              label="Total AI Calls"
              value={summary.total_ai_calls_all_time}
              subValue={summary.total_ai_calls_this_month}
              subLabel="This month"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09z" />
                </svg>
              }
            />
            <SummaryCard
              label="Cache Hit Rate"
              value={`${summary.cache_hit_rate.toFixed(1)}%`}
              subLabel="AI calls saved by cache"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
                </svg>
              }
            />
            <SummaryCard
              label="Total Cost"
              value={`$${summary.total_cost.toFixed(2)}`}
              subLabel="All free-tier"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
              }
            />
          </div>

          {/* Charts */}
          <AnalyticsCharts
            aiUsage={aiUsage}
            costBreakdown={costBreakdown}
            cacheHitTrend={cacheHitTrend}
            productsByDomain={productsByDomain}
            productsByCategory={productsByCategory}
          />

          {/* Bottom Section: Leaderboard + Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Health Leaderboard */}
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                AI Health Leaderboard
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-left">
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">
                        #
                      </th>
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">
                        Model
                      </th>
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">
                        Health
                      </th>
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">
                        Avg Latency
                      </th>
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">
                        Calls
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeaderboard.map((model, i) => (
                      <tr
                        key={model.id}
                        className="border-b border-card-border last:border-0"
                      >
                        <td className="py-2.5 text-muted">{i + 1}</td>
                        <td className="py-2.5">
                          <div>
                            <span className="font-medium text-foreground">
                              {model.name}
                            </span>
                            <span className="text-xs text-muted ml-2">
                              {model.provider}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-card-border rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  model.health_score >= 90
                                    ? "bg-green-500"
                                    : model.health_score >= 70
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${model.health_score}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted">
                              {model.health_score}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-muted">
                          {model.avg_latency_ms}ms
                        </td>
                        <td className="py-2.5 text-muted">
                          {model.total_calls}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Most Used + Avg Workflow + Cost Savings */}
            <div className="space-y-6">
              {/* Most Used AI Models */}
              <div className="rounded-xl border border-card-border bg-card-bg p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Most Used AI Models
                </h3>
                <div className="space-y-3">
                  {mostUsedModels.slice(0, 5).map((model, i) => (
                    <div key={model.id} className="flex items-center gap-3">
                      <span className="text-xs text-muted w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {model.name}
                          </span>
                          <span className="text-xs text-muted ml-2">
                            {model.total_calls} calls
                          </span>
                        </div>
                        <div className="h-1.5 bg-card-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{
                              width: `${(model.total_calls / (mostUsedModels[0]?.total_calls || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Average Workflow Time & Cost Savings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-card-border bg-card-bg p-5">
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">
                    Avg Workflow Time
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {formatDuration(summary.avg_workflow_time_ms)}
                  </p>
                  <p className="text-xs text-muted mt-1">per product</p>
                </div>
                <div className="rounded-xl border border-card-border bg-card-bg p-5">
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">
                    Cost Savings
                  </p>
                  <p className="text-2xl font-bold text-success mt-1">
                    ${summary.cost_savings.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    vs paid APIs
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
