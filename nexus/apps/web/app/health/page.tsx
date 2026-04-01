"use client";

import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { HealthDashboard } from "@/lib/api";

function ProgressBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs text-muted">{value.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-card-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RateCard({ label, rate, total, failed, color }: { label: string; rate: number; total: number; failed: number; color: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-5">
      <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className={`text-3xl font-bold ${color}`}>{rate}%</p>
        <p className="text-xs text-muted mb-1">{total - failed} / {total}</p>
      </div>
      {failed > 0 && (
        <p className="text-xs text-red-400 mt-1">{failed} failed</p>
      )}
    </div>
  );
}

export default function HealthPage() {
  const empty: HealthDashboard = {
    api_credits: {
      workers_requests: { used: 0, limit: 10_000_000 },
      kv_reads: { used: 0, limit: 10_000_000 },
      d1_reads: { used: 0, limit: 25_000_000_000 },
      r2_storage_gb: { used: 0, limit: 10 },
    },
    workflow_success_rate: 100,
    workflow_total: 0,
    workflow_failed: 0,
    publish_success_rate: 100,
    publish_total: 0,
    publish_failed: 0,
    avg_quality_score: 0,
    quality_score_trend: [],
    top_niches: [],
  };

  const { data, loading } = useApiQuery(() => api.healthDashboard.get(), empty);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Health Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          System health, API usage, success rates, and top-performing niches
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
              <div className="h-4 w-24 bg-card-border rounded mb-3" />
              <div className="h-8 w-16 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Success Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <RateCard
              label="Workflow Success"
              rate={data.workflow_success_rate}
              total={data.workflow_total}
              failed={data.workflow_failed}
              color={data.workflow_success_rate >= 90 ? "text-green-400" : data.workflow_success_rate >= 70 ? "text-yellow-400" : "text-red-400"}
            />
            <RateCard
              label="Publish Success"
              rate={data.publish_success_rate}
              total={data.publish_total}
              failed={data.publish_failed}
              color={data.publish_success_rate >= 90 ? "text-green-400" : data.publish_success_rate >= 70 ? "text-yellow-400" : "text-red-400"}
            />
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <p className="text-xs font-medium text-muted uppercase tracking-wider">Avg Quality Score</p>
              <p className="text-3xl font-bold text-foreground mt-1">{data.avg_quality_score}</p>
              <p className="text-xs text-muted mt-1">out of 10</p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <p className="text-xs font-medium text-muted uppercase tracking-wider">Top Niches</p>
              <p className="text-3xl font-bold text-foreground mt-1">{data.top_niches.length}</p>
              <p className="text-xs text-muted mt-1">active niches</p>
            </div>
          </div>

          {/* API Credits */}
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">API Credit Usage (Estimated)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProgressBar label="Workers Requests" value={data.api_credits.workers_requests.used} max={data.api_credits.workers_requests.limit} color="bg-blue-500" />
              <ProgressBar label="KV Reads" value={data.api_credits.kv_reads.used} max={data.api_credits.kv_reads.limit} color="bg-purple-500" />
              <ProgressBar label="D1 Reads" value={data.api_credits.d1_reads.used} max={data.api_credits.d1_reads.limit} color="bg-green-500" />
              <ProgressBar label="R2 Storage (GB)" value={data.api_credits.r2_storage_gb.used} max={data.api_credits.r2_storage_gb.limit} color="bg-orange-500" />
            </div>
          </div>

          {/* Quality Score Trend */}
          {data.quality_score_trend.length > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Quality Score Trend (30 days)</h3>
              <div className="flex items-end gap-1 h-32">
                {data.quality_score_trend.map((point) => (
                  <div key={point.date} className="flex-1 flex flex-col items-center gap-1" title={`${point.date}: ${point.score}`}>
                    <div
                      className="w-full bg-accent rounded-t"
                      style={{ height: `${(point.score / 10) * 100}%` }}
                    />
                    <span className="text-[8px] text-muted rotate-45">{point.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Performing Niches */}
          {data.top_niches.length > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Top Performing Niches</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-left">
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Niche</th>
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Products</th>
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Avg Score</th>
                      <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_niches.map((niche) => (
                      <tr key={niche.niche} className="border-b border-card-border last:border-0">
                        <td className="py-2.5 font-medium text-foreground capitalize">{niche.niche}</td>
                        <td className="py-2.5 text-muted">{niche.products}</td>
                        <td className="py-2.5 text-muted">{niche.avg_score ?? "—"}</td>
                        <td className="py-2.5 text-muted font-mono">${(niche.revenue ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
