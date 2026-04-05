"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import type {
  AIUsageOverTime,
  CostBreakdownItem,
  CacheHitTrendItem,
  DomainBreakdownItem,
  CategoryBreakdownItem,
} from "@/lib/api";

const CHART_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#06b6d4",
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#141414",
    border: "1px solid #262626",
    borderRadius: "8px",
    color: "#ededed",
    fontSize: "12px",
  },
  labelStyle: { color: "#737373" },
};

interface AnalyticsChartsProps {
  aiUsage: AIUsageOverTime[];
  costBreakdown: CostBreakdownItem[];
  cacheHitTrend: CacheHitTrendItem[];
  productsByDomain: DomainBreakdownItem[];
  productsByCategory: CategoryBreakdownItem[];
}

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-muted gap-3">
      <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z" />
      </svg>
      <p className="text-sm">No data yet. Run some workflows to see {label} data here.</p>
    </div>
  );
}

export default function AnalyticsCharts({
  aiUsage,
  costBreakdown,
  cacheHitTrend,
  productsByDomain,
  productsByCategory,
}: AnalyticsChartsProps) {
  // Transform AI usage data for stacked bar chart
  const providers = [...new Set(aiUsage.map((d) => d.provider))];
  const dates = [...new Set(aiUsage.map((d) => d.date))];
  const stackedData = dates.map((date) => {
    const entry: Record<string, string | number> = { date };
    for (const provider of providers) {
      const match = aiUsage.find(
        (d) => d.date === date && d.provider === provider
      );
      entry[provider] = match ? match.tokens : 0;
    }
    return entry;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* AI Usage Over Time - Stacked Bar */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          AI Usage Over Time (Tokens)
        </h3>
        {aiUsage.length === 0 ? (
          <ChartEmptyState label="AI usage" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={{ stroke: "#262626" }}
                />
                <YAxis
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={{ stroke: "#262626" }}
                />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#737373" }} />
                {providers.map((provider, i) => (
                  <Bar
                    key={provider}
                    dataKey={provider}
                    stackId="a"
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Cost Breakdown - Pie Chart */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Cost Breakdown by Provider
        </h3>
        {costBreakdown.length === 0 ? (
          <ChartEmptyState label="cost breakdown" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="cost"
                  nameKey="provider"
                  label={({ name, value }: { name?: string; value?: number }) =>
                    `${name ?? ""}: $${(value ?? 0).toFixed(2)}`
                  }
                  labelLine={{ stroke: "#737373" }}
                >
                  {costBreakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) => `$${Number(value).toFixed(4)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Cache Hit Rate Trend - Line Chart */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Cache Hit Rate Trend
        </h3>
        {cacheHitTrend.length === 0 ? (
          <ChartEmptyState label="cache hit rate" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cacheHitTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={{ stroke: "#262626" }}
                />
                <YAxis
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={{ stroke: "#262626" }}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                />
                <Line
                  type="monotone"
                  dataKey="hit_rate"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: "#6366f1", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Products by Domain - Donut Chart */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Products by Domain
        </h3>
        {productsByDomain.length === 0 ? (
          <ChartEmptyState label="domain distribution" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productsByDomain}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="count"
                  nameKey="domain"
                  label={({ name, value }: { name?: string; value?: number }) =>
                    `${name ?? ""}: ${value ?? 0}`
                  }
                  labelLine={{ stroke: "#737373" }}
                >
                  {productsByDomain.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Products by Category - Horizontal Bar Chart */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Products by Category
        </h3>
        {productsByCategory.length === 0 ? (
          <ChartEmptyState label="category distribution" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productsByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis
                  type="number"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={{ stroke: "#262626" }}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={{ stroke: "#262626" }}
                  width={140}
                />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
