// ============================================================
// Workers AI Neuron Usage Tracker
// Tracks neuron consumption per model call, maintains running
// totals, and raises budget alerts when thresholds are exceeded.
// ============================================================

import type { Env } from "@nexus/shared";
import { now } from "@nexus/shared";

// --- Neuron cost estimates per model (neurons per 1K tokens) ---
// Based on Cloudflare Workers AI pricing documentation.
// These are approximate and should be updated as pricing changes.
const NEURON_COSTS: Record<string, number> = {
  "@cf/meta/llama-3.1-8b-instruct": 0.011,
  "@cf/stabilityai/stable-diffusion-xl-base-1.0": 0.024,
  "@cf/openai/whisper": 0.017,
};

const DEFAULT_NEURON_COST = 0.011;

/** KV key for persisted neuron usage */
const NEURON_USAGE_KV_KEY = "neuron_usage";
/** KV TTL: 30 days */
const NEURON_USAGE_KV_TTL = 2592000;
/** Persist every N calls */
const NEURON_PERSIST_INTERVAL = 5;

/** In-memory neuron usage data */
interface NeuronUsage {
  /** Total neurons consumed this billing period */
  totalNeurons: number;
  /** Total calls tracked */
  totalCalls: number;
  /** Per-model breakdown */
  byModel: Record<string, { neurons: number; calls: number }>;
  /** Daily usage for trend tracking */
  dailyUsage: Record<string, number>;
  /** Budget threshold (neurons) — loaded from settings */
  budgetLimit: number;
  /** Last reset date (YYYY-MM-DD) */
  lastResetDate: string;
  /** Alerts raised */
  alerts: NeuronAlert[];
}

export interface NeuronAlert {
  type: "warning" | "critical";
  message: string;
  percentage: number;
  timestamp: string;
}

export interface NeuronReport {
  totalNeurons: number;
  totalCalls: number;
  budgetLimit: number;
  budgetUsedPercent: number;
  byModel: Record<string, { neurons: number; calls: number }>;
  dailyUsage: Record<string, number>;
  alerts: NeuronAlert[];
  estimatedMonthlyCost: string;
}

/** Default budget: 10,000 neurons/month (free tier is ~10K) */
const DEFAULT_BUDGET_LIMIT = 10000;

let usage: NeuronUsage | null = null;
let usageRestored = false;

/** Restore usage from KV on first call */
async function restoreUsage(env: Env): Promise<NeuronUsage> {
  if (usage) return usage;

  if (!usageRestored) {
    usageRestored = true;
    const persisted = await env.KV.get<NeuronUsage>(
      NEURON_USAGE_KV_KEY,
      "json"
    ).catch(() => null);

    if (persisted) {
      usage = persisted;

      // Reset if we're in a new month
      const today = new Date().toISOString().slice(0, 7); // YYYY-MM
      const lastReset = persisted.lastResetDate?.slice(0, 7);
      if (today !== lastReset) {
        usage = createFreshUsage();
        console.log("[NEURON] New billing period — resetting usage");
      } else {
        console.log(
          `[NEURON] Restored usage from KV: ${usage.totalNeurons.toFixed(2)} neurons`
        );
      }
      return usage;
    }
  }

  // Load budget from settings if available
  let budgetLimit = DEFAULT_BUDGET_LIMIT;
  if (env.NEXUS_STORAGE) {
    try {
      const resp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "SELECT value FROM settings WHERE key = 'neuron_budget_limit'",
          params: [],
        }),
      });
      const json = (await resp.json()) as {
        success: boolean;
        data?: { results?: Array<{ value: string }> };
      };
      if (json.success && json.data?.results?.[0]) {
        budgetLimit = parseInt(json.data.results[0].value, 10) || DEFAULT_BUDGET_LIMIT;
      }
    } catch {
      // Use default
    }
  }

  usage = createFreshUsage(budgetLimit);
  return usage;
}

function createFreshUsage(budgetLimit = DEFAULT_BUDGET_LIMIT): NeuronUsage {
  return {
    totalNeurons: 0,
    totalCalls: 0,
    byModel: {},
    dailyUsage: {},
    budgetLimit,
    lastResetDate: new Date().toISOString().slice(0, 10),
    alerts: [],
  };
}

/** Persist usage to KV */
async function persistUsage(env: Env): Promise<void> {
  if (!usage) return;
  await env.KV.put(NEURON_USAGE_KV_KEY, JSON.stringify(usage), {
    expirationTtl: NEURON_USAGE_KV_TTL,
  }).catch(() => {
    console.log("[NEURON] Could not persist neuron usage");
  });
}

// ============================================================
// TRACK NEURON USAGE — called after every Workers AI call
// ============================================================

export async function trackNeuronUsage(
  model: string,
  tokens: number,
  env: Env
): Promise<void> {
  const u = await restoreUsage(env);

  // Estimate neuron cost
  const costPer1K = NEURON_COSTS[model] ?? DEFAULT_NEURON_COST;
  const neurons = (tokens / 1000) * costPer1K;

  // Update totals
  u.totalNeurons += neurons;
  u.totalCalls++;

  // Update per-model breakdown
  if (!u.byModel[model]) {
    u.byModel[model] = { neurons: 0, calls: 0 };
  }
  u.byModel[model].neurons += neurons;
  u.byModel[model].calls++;

  // Update daily usage
  const today = new Date().toISOString().slice(0, 10);
  u.dailyUsage[today] = (u.dailyUsage[today] ?? 0) + neurons;

  // Check budget alerts
  const usedPercent = (u.totalNeurons / u.budgetLimit) * 100;

  if (usedPercent >= 90 && !u.alerts.some((a) => a.percentage >= 90)) {
    u.alerts.push({
      type: "critical",
      message: `Neuron usage at ${usedPercent.toFixed(1)}% of budget (${u.totalNeurons.toFixed(0)}/${u.budgetLimit})`,
      percentage: usedPercent,
      timestamp: now(),
    });
    console.warn(`[NEURON] CRITICAL: Usage at ${usedPercent.toFixed(1)}% of budget`);
  } else if (usedPercent >= 75 && !u.alerts.some((a) => a.percentage >= 75)) {
    u.alerts.push({
      type: "warning",
      message: `Neuron usage at ${usedPercent.toFixed(1)}% of budget (${u.totalNeurons.toFixed(0)}/${u.budgetLimit})`,
      percentage: usedPercent,
      timestamp: now(),
    });
    console.warn(`[NEURON] WARNING: Usage at ${usedPercent.toFixed(1)}% of budget`);
  }

  // Persist periodically
  if (u.totalCalls % NEURON_PERSIST_INTERVAL === 0) {
    await persistUsage(env);
  }
}

// ============================================================
// GET NEURON REPORT — for admin/dashboard
// ============================================================

export async function getNeuronReport(env: Env): Promise<NeuronReport> {
  const u = await restoreUsage(env);
  const usedPercent = u.budgetLimit > 0
    ? (u.totalNeurons / u.budgetLimit) * 100
    : 0;

  // Estimate monthly cost: Cloudflare charges ~$0.011 per 1000 neurons
  const estimatedCost = u.totalNeurons * 0.000011;

  return {
    totalNeurons: Math.round(u.totalNeurons * 100) / 100,
    totalCalls: u.totalCalls,
    budgetLimit: u.budgetLimit,
    budgetUsedPercent: Math.round(usedPercent * 10) / 10,
    byModel: u.byModel,
    dailyUsage: u.dailyUsage,
    alerts: u.alerts,
    estimatedMonthlyCost: `$${estimatedCost.toFixed(4)}`,
  };
}
