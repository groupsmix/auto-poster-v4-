"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { CompetitorPriceSummary, PriceRule } from "@/lib/api";

export default function CompetitorPricingPage() {
  const { data: summaries, loading } = useApiQuery(
    () => api.competitorPricing.summaries(),
    [] as CompetitorPriceSummary[],
  );
  const { data: rules, refetch: refetchRules } = useApiQuery(
    () => api.competitorPricing.rules(),
    [] as PriceRule[],
  );

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleNiche, setRuleNiche] = useState("");
  const [rulePlatform, setRulePlatform] = useState("etsy");
  const [ruleStrategy, setRuleStrategy] = useState("below_average");
  const [ruleAdjustment, setRuleAdjustment] = useState(-10);
  const [saving, setSaving] = useState(false);

  async function handleCreateRule() {
    if (!ruleNiche.trim()) return;
    setSaving(true);
    await api.competitorPricing.createRule({
      niche: ruleNiche,
      platform: rulePlatform,
      strategy: ruleStrategy,
      adjustment_pct: ruleAdjustment,
    });
    setRuleNiche("");
    setShowRuleForm(false);
    setSaving(false);
    refetchRules();
  }

  async function handleDeleteRule(id: string) {
    if (!confirm("Delete this price rule?")) return;
    await api.competitorPricing.deleteRule(id);
    refetchRules();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Competitor Price Monitoring</h1>
        <p className="text-muted text-sm mt-1">
          Track competitor pricing and auto-adjust your prices to stay competitive
        </p>
      </div>

      {/* Price Summaries */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
              <div className="h-4 w-32 bg-card-border rounded mb-3" />
              <div className="h-8 w-20 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center mb-6">
          <p className="text-muted">No competitor pricing data yet.</p>
          <p className="text-xs text-muted mt-1">
            Use the API to submit competitor pricing data for your niches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {summaries.map((s) => {
            const rule = rules.find((r) => r.niche === s.niche && r.platform === s.platform);
            return (
              <div key={`${s.niche}-${s.platform}`} className="rounded-xl border border-card-border bg-card-bg p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-foreground capitalize">{s.niche}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-card-border text-muted">{s.platform}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted">Low</p>
                    <p className="text-sm font-bold text-foreground">${s.min_price}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Average</p>
                    <p className="text-sm font-bold text-foreground">${s.avg_price}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">High</p>
                    <p className="text-sm font-bold text-foreground">${s.max_price}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-card-border flex items-center justify-between">
                  <span className="text-xs text-muted">{s.count} competitors</span>
                  <div className="text-right">
                    <p className="text-xs text-muted">Suggested Price</p>
                    <p className="text-lg font-bold text-accent">${s.suggested_price}</p>
                  </div>
                </div>
                {rule && (
                  <div className="mt-2 text-xs text-muted">
                    Rule: {rule.strategy.replace("_", " ")} ({rule.adjustment_pct > 0 ? "+" : ""}{rule.adjustment_pct}%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Price Rules */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Price Rules</h2>
        <button
          onClick={() => setShowRuleForm(!showRuleForm)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          {showRuleForm ? "Cancel" : "+ Add Rule"}
        </button>
      </div>

      {showRuleForm && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Niche</label>
              <input
                type="text"
                value={ruleNiche}
                onChange={(e) => setRuleNiche(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
                placeholder="e.g. planner"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Platform</label>
              <select
                value={rulePlatform}
                onChange={(e) => setRulePlatform(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
              >
                <option value="etsy">Etsy</option>
                <option value="amazon">Amazon</option>
                <option value="shopify">Shopify</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Strategy</label>
              <select
                value={ruleStrategy}
                onChange={(e) => setRuleStrategy(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
              >
                <option value="below_average">Below Average</option>
                <option value="match_lowest">Match Lowest</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Adjustment %</label>
              <input
                type="number"
                value={ruleAdjustment}
                onChange={(e) => setRuleAdjustment(Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
              />
            </div>
          </div>
          <button
            onClick={handleCreateRule}
            disabled={saving || !ruleNiche.trim()}
            className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Rule"}
          </button>
        </div>
      )}

      {rules.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left bg-card-bg">
                <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Niche</th>
                <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Platform</th>
                <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Strategy</th>
                <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Adjustment</th>
                <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Min/Max</th>
                <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-card-border last:border-0">
                  <td className="px-4 py-2.5 text-foreground capitalize">{rule.niche}</td>
                  <td className="px-4 py-2.5 text-muted capitalize">{rule.platform}</td>
                  <td className="px-4 py-2.5 text-muted capitalize">{rule.strategy.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 text-muted">{rule.adjustment_pct > 0 ? "+" : ""}{rule.adjustment_pct}%</td>
                  <td className="px-4 py-2.5 text-muted font-mono">${rule.min_price} - ${rule.max_price}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:opacity-80"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
