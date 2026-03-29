"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import { useApiQuery } from "@/lib/useApiQuery";
import type { AIModel } from "@/lib/api";

// Task type labels for grouping
const TASK_TYPES = [
  { key: "research", label: "Research" },
  { key: "writing", label: "Writing & Content" },
  { key: "seo", label: "SEO Formatting" },
  { key: "reasoning", label: "Reasoning & Analysis" },
  { key: "code", label: "Code Generation" },
  { key: "image", label: "Image & Visual" },
  { key: "audio", label: "Audio & Music" },
  { key: "variation", label: "Platform Variation" },
  { key: "social", label: "Social Adaptation" },
  { key: "review", label: "CEO Review" },
] as const;

// Mock AI models matching the architecture doc (Part 5/6)
const MOCK_MODELS: AIModel[] = [
  // Research
  { id: "ai-tavily", name: "Tavily Search", provider: "tavily.com", task_type: "research", rank: 1, api_key_secret_name: "TAVILY_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 95, total_calls: 342, total_failures: 17, avg_latency_ms: 1200, notes: "Purpose-built for AI agents" },
  { id: "ai-exa", name: "Exa Neural Search", provider: "exa.ai", task_type: "research", rank: 2, api_key_secret_name: "EXA_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 92, total_calls: 210, total_failures: 16, avg_latency_ms: 980, notes: "Finds by meaning not keywords" },
  { id: "ai-serpapi", name: "SerpAPI", provider: "serpapi.com", task_type: "research", rank: 3, api_key_secret_name: "SERPAPI_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 98, total_calls: 150, total_failures: 3, avg_latency_ms: 800, notes: "Raw Google results" },
  { id: "ai-deepseek-research", name: "DeepSeek-V3", provider: "deepseek.com", task_type: "research", rank: 4, api_key_secret_name: "DEEPSEEK_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 97, total_calls: 85, total_failures: 2, avg_latency_ms: 1500, notes: "Reasoning fallback" },
  { id: "ai-workers-research", name: "Workers AI (Llama 3.1)", provider: "Cloudflare", task_type: "research", rank: 5, api_key_secret_name: null, is_workers_ai: true, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 100, total_calls: 30, total_failures: 0, avg_latency_ms: 300, notes: "Ultimate fallback. On-platform, always available." },

  // Writing
  { id: "ai-deepseek-write", name: "DeepSeek-V3", provider: "deepseek.com", task_type: "writing", rank: 1, api_key_secret_name: "DEEPSEEK_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 94, total_calls: 520, total_failures: 31, avg_latency_ms: 2100, notes: "Best free long-form quality" },
  { id: "ai-qwen-write", name: "Qwen 3.5 Max", provider: "SiliconFlow", task_type: "writing", rank: 2, api_key_secret_name: "SILICONFLOW_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 91, total_calls: 310, total_failures: 27, avg_latency_ms: 1800, notes: "Strong long-form" },
  { id: "ai-doubao", name: "Doubao 1.5 Pro", provider: "SiliconFlow", task_type: "writing", rank: 3, api_key_secret_name: "SILICONFLOW_API_KEY", is_workers_ai: false, status: "rate_limited", rate_limit_reset_at: "2025-03-21T12:00:00Z", daily_limit_reset_at: null, is_free_tier: true, health_score: 88, total_calls: 180, total_failures: 21, avg_latency_ms: 1600, notes: "Most human-like narrative flow" },
  { id: "ai-kimi", name: "Kimi k1.5", provider: "moonshot.cn", task_type: "writing", rank: 4, api_key_secret_name: "MOONSHOT_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 90, total_calls: 95, total_failures: 9, avg_latency_ms: 2500, notes: "10M token context" },
  { id: "ai-workers-write", name: "Workers AI (Llama 3.1)", provider: "Cloudflare", task_type: "writing", rank: 5, api_key_secret_name: null, is_workers_ai: true, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 100, total_calls: 15, total_failures: 0, avg_latency_ms: 350, notes: "Emergency fallback" },
  { id: "ai-claude-write", name: "Claude Sonnet 4.5", provider: "anthropic.com", task_type: "writing", rank: 6, api_key_secret_name: "ANTHROPIC_API_KEY", is_workers_ai: false, status: "sleeping", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: false, health_score: 0, total_calls: 0, total_failures: 0, avg_latency_ms: 0, notes: "Best quality writing. Add key to activate." },
  { id: "ai-gpt-write", name: "GPT-5.4", provider: "openai.com", task_type: "writing", rank: 7, api_key_secret_name: "OPENAI_API_KEY", is_workers_ai: false, status: "sleeping", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: false, health_score: 0, total_calls: 0, total_failures: 0, avg_latency_ms: 0, notes: "Top-tier long-form. Add key to activate." },

  // SEO
  { id: "ai-qwen-seo", name: "Qwen 3.5 Flash", provider: "SiliconFlow", task_type: "seo", rank: 1, api_key_secret_name: "SILICONFLOW_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 96, total_calls: 420, total_failures: 16, avg_latency_ms: 600, notes: "Fastest + best at constrained output" },
  { id: "ai-deepseek-seo", name: "DeepSeek-V3", provider: "deepseek.com", task_type: "seo", rank: 2, api_key_secret_name: "DEEPSEEK_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 93, total_calls: 280, total_failures: 19, avg_latency_ms: 900, notes: "Reliable rule-following" },
  { id: "ai-mistral-seo", name: "Mistral 7B", provider: "Groq", task_type: "seo", rank: 3, api_key_secret_name: "GROQ_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 89, total_calls: 120, total_failures: 13, avg_latency_ms: 400, notes: "Ultra-fast free inference" },
  { id: "ai-workers-seo", name: "Workers AI (Llama 3.1)", provider: "Cloudflare", task_type: "seo", rank: 4, api_key_secret_name: null, is_workers_ai: true, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 100, total_calls: 10, total_failures: 0, avg_latency_ms: 280, notes: "Structured output fallback" },

  // Image
  { id: "ai-flux", name: "FLUX.1 Pro", provider: "fal.ai", task_type: "image", rank: 1, api_key_secret_name: "FAL_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 91, total_calls: 200, total_failures: 18, avg_latency_ms: 8000, notes: "#1 for text rendering in images" },
  { id: "ai-ideogram", name: "Ideogram 3.0", provider: "ideogram.ai", task_type: "image", rank: 2, api_key_secret_name: "IDEOGRAM_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 87, total_calls: 110, total_failures: 14, avg_latency_ms: 12000, notes: "Typography + graphic design" },
  { id: "ai-sdxl", name: "SDXL", provider: "HuggingFace", task_type: "image", rank: 3, api_key_secret_name: "HF_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 85, total_calls: 90, total_failures: 13, avg_latency_ms: 15000, notes: "Free, open. Good for illustrations" },
  { id: "ai-workers-img", name: "Workers AI (SDXL)", provider: "Cloudflare", task_type: "image", rank: 4, api_key_secret_name: null, is_workers_ai: true, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 100, total_calls: 8, total_failures: 0, avg_latency_ms: 5000, notes: "On-platform image gen" },
  { id: "ai-midjourney", name: "Midjourney", provider: "PiAPI", task_type: "image", rank: 5, api_key_secret_name: "PIAPI_KEY", is_workers_ai: false, status: "sleeping", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: false, health_score: 0, total_calls: 0, total_failures: 0, avg_latency_ms: 0, notes: "Highest artistic quality. Add key to activate." },

  // Audio
  { id: "ai-suno", name: "Suno", provider: "suno.com", task_type: "audio", rank: 1, api_key_secret_name: "SUNO_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 93, total_calls: 75, total_failures: 5, avg_latency_ms: 30000, notes: "50 songs/day free" },
  { id: "ai-musicgen", name: "MusicGen", provider: "HuggingFace", task_type: "audio", rank: 2, api_key_secret_name: "HF_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 88, total_calls: 40, total_failures: 4, avg_latency_ms: 25000, notes: "Open source. No limits." },

  // Reasoning
  { id: "ai-deepseek-r1", name: "DeepSeek-R1", provider: "deepseek.com", task_type: "reasoning", rank: 1, api_key_secret_name: "DEEPSEEK_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 96, total_calls: 180, total_failures: 7, avg_latency_ms: 3200, notes: "Best free reasoning model" },
  { id: "ai-qwen-reason", name: "Qwen 3.5 Max", provider: "SiliconFlow", task_type: "reasoning", rank: 2, api_key_secret_name: "SILICONFLOW_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 93, total_calls: 95, total_failures: 6, avg_latency_ms: 2800, notes: "Strong analytical reasoning" },
  { id: "ai-workers-reason", name: "Workers AI (Llama 3.1)", provider: "Cloudflare", task_type: "reasoning", rank: 3, api_key_secret_name: null, is_workers_ai: true, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 100, total_calls: 5, total_failures: 0, avg_latency_ms: 320, notes: "Basic reasoning fallback" },
  { id: "ai-gemini", name: "Gemini 3.1 Pro", provider: "google.com", task_type: "reasoning", rank: 4, api_key_secret_name: "GOOGLE_AI_KEY", is_workers_ai: false, status: "sleeping", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: false, health_score: 0, total_calls: 0, total_failures: 0, avg_latency_ms: 0, notes: "#1 ARC-AGI-2 benchmark. Add key to activate." },

  // Code
  { id: "ai-deepseek-code", name: "DeepSeek-Coder-V3", provider: "deepseek.com", task_type: "code", rank: 1, api_key_secret_name: "DEEPSEEK_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 95, total_calls: 120, total_failures: 6, avg_latency_ms: 2000, notes: "Purpose-built for software" },
  { id: "ai-qwen-code", name: "Qwen 3.5 (Coder)", provider: "SiliconFlow", task_type: "code", rank: 2, api_key_secret_name: "SILICONFLOW_API_KEY", is_workers_ai: false, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 92, total_calls: 80, total_failures: 6, avg_latency_ms: 1900, notes: "Strong full-stack" },
  { id: "ai-workers-code", name: "Workers AI (Llama 3.1)", provider: "Cloudflare", task_type: "code", rank: 3, api_key_secret_name: null, is_workers_ai: true, status: "active", rate_limit_reset_at: null, daily_limit_reset_at: null, is_free_tier: true, health_score: 100, total_calls: 3, total_failures: 0, avg_latency_ms: 340, notes: "Simple code generation fallback" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-500/10 text-green-400",
    sleeping: "bg-gray-500/10 text-gray-400",
    rate_limited: "bg-yellow-500/10 text-yellow-400",
    no_key: "bg-red-500/10 text-red-400",
  };
  const labels: Record<string, string> = {
    active: "Active",
    sleeping: "Sleeping",
    rate_limited: "Rate Limited",
    no_key: "No Key",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? styles.sleeping}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        status === "active" ? "bg-green-400" :
        status === "rate_limited" ? "bg-yellow-400" :
        status === "no_key" ? "bg-red-400" : "bg-gray-400"
      }`} />
      {labels[status] ?? status}
    </span>
  );
}

function HealthBar({ score, size = "normal" }: { score: number; size?: "normal" | "small" }) {
  const color =
    score >= 90 ? "bg-green-500" :
    score >= 70 ? "bg-yellow-500" :
    score >= 50 ? "bg-orange-500" : "bg-red-500";

  const height = size === "small" ? "h-1.5" : "h-2";

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} bg-card-hover rounded-full overflow-hidden`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${
        score >= 90 ? "text-green-400" :
        score >= 70 ? "text-yellow-400" :
        score >= 50 ? "text-orange-400" : "text-red-400"
      }`}>
        {score}%
      </span>
    </div>
  );
}

function formatLatency(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function AIManagerPage() {
  const { data: fetchedModels, loading, isUsingMock } = useApiQuery(
    () => api.aiModels.list(),
    MOCK_MODELS,
  );

  const [models, setModels] = useState<AIModel[]>(MOCK_MODELS);
  const [activeTaskType, setActiveTaskType] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState<{ modelId: string; value: string } | null>(null);
  const [addingKey, setAddingKey] = useState(false);
  const [dragState, setDragState] = useState<{ taskType: string; dragIdx: number; overIdx: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, boolean>>({});

  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  // Sync hook data into local mutable state
  useEffect(() => {
    setModels(fetchedModels);
  }, [fetchedModels]);

  // Group models by task type
  const modelsByTask: Record<string, AIModel[]> = {};
  for (const model of models) {
    if (!modelsByTask[model.task_type]) {
      modelsByTask[model.task_type] = [];
    }
    modelsByTask[model.task_type].push(model);
  }
  // Sort each group by rank
  for (const key of Object.keys(modelsByTask)) {
    modelsByTask[key].sort((a, b) => a.rank - b.rank);
  }

  // Check for auto-suggest reorder (model #2 has higher health than #1)
  useEffect(() => {
    const newSuggestions: Record<string, boolean> = {};
    for (const [taskType, taskModels] of Object.entries(modelsByTask)) {
      if (taskModels.length >= 2) {
        const first = taskModels[0];
        const second = taskModels[1];
        if (
          second.health_score > first.health_score &&
          second.total_calls > 50 &&
          first.total_calls > 50
        ) {
          newSuggestions[taskType] = true;
        }
      }
    }
    setSuggestions(newSuggestions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  const handleAddKey = async (modelId: string) => {
    if (!keyInput || keyInput.modelId !== modelId || !keyInput.value.trim()) return;
    setAddingKey(true);
    try {
      await api.aiModels.addKey(modelId, keyInput.value.trim());
    } catch {
      // best-effort
    }
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId ? { ...m, status: "active", health_score: 100 } : m
      )
    );
    setKeyInput(null);
    setAddingKey(false);
  };

  const handleRemoveKey = async (modelId: string) => {
    try {
      await api.aiModels.removeKey(modelId);
    } catch {
      // best-effort
    }
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId ? { ...m, status: "sleeping", health_score: 0, total_calls: 0, total_failures: 0, avg_latency_ms: 0 } : m
      )
    );
  };

  const handleDragStart = (taskType: string, idx: number) => {
    dragItemRef.current = idx;
    setDragState({ taskType, dragIdx: idx, overIdx: idx });
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverRef.current = idx;
    if (dragState) {
      setDragState({ ...dragState, overIdx: idx });
    }
  };

  const handleDrop = async (taskType: string) => {
    if (dragItemRef.current === null || dragOverRef.current === null) return;
    const taskModels = [...(modelsByTask[taskType] ?? [])];
    const dragIdx = dragItemRef.current;
    const dropIdx = dragOverRef.current;

    if (dragIdx === dropIdx) {
      setDragState(null);
      return;
    }

    const [removed] = taskModels.splice(dragIdx, 1);
    taskModels.splice(dropIdx, 0, removed);

    // Update ranks
    const updatedModels = taskModels.map((m, i) => ({ ...m, rank: i + 1 }));
    setModels((prev) => {
      const others = prev.filter((m) => m.task_type !== taskType);
      return [...others, ...updatedModels];
    });

    try {
      await api.aiModels.reorder(taskType, updatedModels.map((m) => m.id));
    } catch {
      // best-effort
    }

    dragItemRef.current = null;
    dragOverRef.current = null;
    setDragState(null);
  };

  // Visible task types: either all, or filtered
  const visibleTaskTypes = activeTaskType
    ? TASK_TYPES.filter((t) => t.key === activeTaskType)
    : TASK_TYPES.filter((t) => modelsByTask[t.key]?.length);

  // Workers AI summary
  const workersAIModels = models.filter((m) => m.is_workers_ai);
  const workersAITotalCalls = workersAIModels.reduce((sum, m) => sum + m.total_calls, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Manager</h1>
          <p className="text-muted text-sm mt-1">
            AI models, health scores, and failover chains
          </p>
        </div>
        <a
          href="https://dash.cloudflare.com/?to=/:account/ai/ai-gateway"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          AI Gateway Dashboard
        </a>
      </div>

      {isUsingMock && <MockDataBanner />}

      {/* Workers AI summary card */}
      <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Workers AI — Always Active</h3>
              <p className="text-xs text-muted">On-platform fallback. No API key needed. 10,000 neurons/day included free.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <div>
              <span className="text-foreground font-mono">{workersAITotalCalls}</span> total calls
            </div>
            <div>
              <span className="text-foreground font-mono">0</span> failures
            </div>
            <StatusBadge status="active" />
          </div>
        </div>
      </div>

      {/* Task type filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTaskType(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTaskType === null
              ? "bg-accent text-white"
              : "bg-card-bg border border-card-border text-muted hover:text-foreground hover:bg-card-hover"
          }`}
        >
          All Types
        </button>
        {TASK_TYPES.map((t) => {
          const count = modelsByTask[t.key]?.length ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTaskType(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTaskType === t.key
                  ? "bg-accent text-white"
                  : "bg-card-bg border border-card-border text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${activeTaskType === t.key ? "opacity-70" : ""}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse">
              <div className="h-5 bg-card-hover rounded w-40 mb-4" />
              <div className="space-y-3">
                <div className="h-16 bg-card-hover rounded" />
                <div className="h-16 bg-card-hover rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Model groups by task type */}
      {!loading && (
        <div className="space-y-6">
          {visibleTaskTypes.map(({ key: taskType, label }) => {
            const taskModels = modelsByTask[taskType];
            if (!taskModels?.length) return null;

            return (
              <div key={taskType} className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                {/* Group header */}
                <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-foreground">{label}</h2>
                    <span className="text-xs text-muted">
                      {taskModels.filter((m) => m.status === "active").length} active / {taskModels.length} total
                    </span>
                  </div>
                  <span className="text-xs text-muted">Drag to reorder failover priority</span>
                </div>

                {/* Reorder suggestion banner */}
                {suggestions[taskType] && (
                  <div className="px-6 py-3 bg-yellow-500/5 border-b border-yellow-500/20 flex items-center gap-2 text-xs text-yellow-400">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <span>
                      <strong>{taskModels[1]?.name}</strong> has higher health ({taskModels[1]?.health_score}%) than <strong>{taskModels[0]?.name}</strong> ({taskModels[0]?.health_score}%). Consider reordering.
                    </span>
                    <button
                      onClick={() => setSuggestions((prev) => ({ ...prev, [taskType]: false }))}
                      className="ml-auto text-muted hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Model list */}
                <div className="divide-y divide-card-border">
                  {taskModels.map((model, idx) => (
                    <div
                      key={model.id}
                      draggable
                      onDragStart={() => handleDragStart(taskType, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(taskType)}
                      onDragEnd={() => setDragState(null)}
                      className={`px-6 py-4 flex items-center gap-4 transition-colors cursor-grab active:cursor-grabbing ${
                        dragState?.taskType === taskType && dragState.overIdx === idx
                          ? "bg-accent/5"
                          : "hover:bg-card-hover"
                      } ${model.is_workers_ai ? "bg-green-500/[0.02]" : ""}`}
                    >
                      {/* Drag handle + rank */}
                      <div className="flex items-center gap-2 shrink-0">
                        <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                        <span className="w-6 h-6 rounded bg-card-hover flex items-center justify-center text-xs font-mono text-muted">
                          {model.rank}
                        </span>
                      </div>

                      {/* Model info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{model.name}</span>
                          <span className="text-xs text-muted">{model.provider}</span>
                          {model.is_workers_ai && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                              Workers AI
                            </span>
                          )}
                          {!model.is_free_tier && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                              Paid
                            </span>
                          )}
                        </div>
                        {model.notes && (
                          <p className="text-xs text-muted truncate">{model.notes}</p>
                        )}
                      </div>

                      {/* Health bar */}
                      <div className="w-32 shrink-0">
                        {model.status === "active" || model.status === "rate_limited" ? (
                          <HealthBar score={model.health_score} size="small" />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 shrink-0 text-xs text-muted">
                        <div className="text-right w-16">
                          <div className="text-foreground font-mono">{formatLatency(model.avg_latency_ms)}</div>
                          <div>avg latency</div>
                        </div>
                        <div className="text-right w-16">
                          <div className="text-foreground font-mono">{formatNumber(model.total_calls)}</div>
                          <div>calls</div>
                        </div>
                        <div className="text-right w-16">
                          <div className={`font-mono ${model.total_failures > 0 ? "text-red-400" : "text-foreground"}`}>
                            {formatNumber(model.total_failures)}
                          </div>
                          <div>failures</div>
                        </div>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadge status={model.status} />

                        {model.status === "sleeping" && !model.is_workers_ai && (
                          <>
                            {keyInput?.modelId === model.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="password"
                                  value={keyInput.value}
                                  onChange={(e) => setKeyInput({ modelId: model.id, value: e.target.value })}
                                  placeholder="Paste API key..."
                                  className="w-40 px-2 py-1 rounded border border-card-border bg-[#111] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleAddKey(model.id)}
                                  disabled={addingKey || !keyInput.value.trim()}
                                  className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                  {addingKey ? "..." : "Add"}
                                </button>
                                <button
                                  onClick={() => setKeyInput(null)}
                                  className="px-2 py-1 rounded text-xs text-muted hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setKeyInput({ modelId: model.id, value: "" })}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                              >
                                Add API Key
                              </button>
                            )}
                          </>
                        )}

                        {model.status === "active" && !model.is_workers_ai && (
                          <button
                            onClick={() => handleRemoveKey(model.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-muted hover:text-red-400 hover:border-red-500/30 transition-colors"
                          >
                            Remove Key
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
