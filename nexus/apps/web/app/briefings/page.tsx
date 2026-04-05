"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { BriefingResponse, BriefingSectionData, BriefingSettingsData } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { toast } from "sonner";

// --- Section icon + color mapping ---

const sectionMeta: Record<string, { icon: string; color: string; bg: string }> = {
  trends: { icon: "📈", color: "text-blue-400", bg: "bg-blue-500/10" },
  predictions: { icon: "🔮", color: "text-purple-400", bg: "bg-purple-500/10" },
  opportunities: { icon: "💡", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  action_items: { icon: "🎯", color: "text-green-400", bg: "bg-green-500/10" },
  niche_hacks: { icon: "🔥", color: "text-red-400", bg: "bg-red-500/10" },
};

function ConfidenceBadge({ confidence }: { confidence?: "high" | "medium" | "low" }) {
  if (!confidence) return null;
  const styles = {
    high: "bg-green-500/10 text-green-400",
    medium: "bg-yellow-500/10 text-yellow-400",
    low: "bg-red-500/10 text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[confidence]}`}>
      {confidence}
    </span>
  );
}

function BriefingSection({ section }: { section: BriefingSectionData }) {
  const meta = sectionMeta[section.type] ?? { icon: "📋", color: "text-gray-400", bg: "bg-gray-500/10" };

  return (
    <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
      <div className={`px-5 py-3 ${meta.bg} border-b border-card-border flex items-center gap-2`}>
        <span className="text-lg">{meta.icon}</span>
        <h3 className={`text-sm font-semibold ${meta.color}`}>{section.title}</h3>
        <span className="text-xs text-muted ml-auto">{section.items.length} items</span>
      </div>
      <div className="divide-y divide-card-border">
        {section.items.map((item, i) => (
          <div key={i} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h4 className="text-sm font-medium text-foreground">{item.headline}</h4>
              <ConfidenceBadge confidence={item.confidence} />
            </div>
            <p className="text-sm text-muted leading-relaxed">{item.detail}</p>
            {(item.tags?.length || item.domain) && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {item.domain && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">
                    {item.domain}
                  </span>
                )}
                {item.tags?.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-card-hover text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// --- Common timezones for the dropdown ---
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function BriefingsPage() {
  const { data: briefings, loading, refetch } = useApiQuery(
    () => api.briefings.list(20),
    [] as BriefingResponse[],
  );
  const { data: settings, refetch: refetchSettings } = useApiQuery(
    () => api.briefings.settings.get(),
    null as BriefingSettingsData | null,
  );

  const [generating, setGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedBriefing, setSelectedBriefing] = useState<BriefingResponse | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings form state
  const [formTimezone, setFormTimezone] = useState("");
  const [formHour, setFormHour] = useState(8);
  const [formEnabled, setFormEnabled] = useState(false);
  const [formKeywords, setFormKeywords] = useState("");

  function openSettings() {
    if (settings) {
      setFormTimezone(settings.user_timezone || "UTC");
      setFormHour(settings.briefing_hour ?? 8);
      setFormEnabled(settings.briefing_enabled ?? false);
      setFormKeywords(settings.focus_keywords?.join(", ") ?? "");
    }
    setShowSettings(true);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await api.briefings.generate();
      if (!res.success) {
        toast.error(res.error || "Failed to generate briefing");
      }
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate briefing");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const keywords = formKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await api.briefings.settings.update({
        user_timezone: formTimezone,
        briefing_hour: formHour,
        briefing_enabled: formEnabled,
        focus_keywords: keywords,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to save settings");
        return;
      }

      setShowSettings(false);
      refetchSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this briefing?")) return;
    const res = await api.briefings.delete(id);
    if (!res.success) {
      toast.error(res.error || "Failed to delete briefing");
      return;
    }
    if (selectedBriefing?.id === id) setSelectedBriefing(null);
    refetch();
  }

  // Get the latest briefing for the hero section
  const latestBriefing = briefings.length > 0 ? briefings[0] : null;

  // Parse sections if they come as string
  function parseSections(briefing: BriefingResponse): BriefingSectionData[] {
    if (typeof briefing.sections === "string") {
      try {
        return JSON.parse(briefing.sections) as BriefingSectionData[];
      } catch {
        return [];
      }
    }
    return briefing.sections ?? [];
  }

  const displayBriefing = selectedBriefing ?? latestBriefing;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Intelligence Briefing</h1>
          <p className="text-muted text-sm mt-1">
            AI-powered business intelligence delivered daily
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openSettings}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-card-border text-foreground hover:bg-card-hover transition-colors"
          >
            Settings
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Now"}
          </button>
        </div>
      </div>

      {/* Status bar */}
      {settings && (
        <div className="rounded-lg border border-card-border bg-card-bg px-4 py-3 mb-6 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${settings.briefing_enabled ? "bg-green-400" : "bg-gray-500"}`} />
              <span className="text-muted">{settings.briefing_enabled ? "Auto-briefing enabled" : "Auto-briefing disabled"}</span>
            </span>
            <span className="text-muted">
              Schedule: {settings.briefing_hour}:00 ({settings.user_timezone})
            </span>
          </div>
          {settings.last_generated_at && (
            <span className="text-muted text-xs">
              Last generated: {formatDate(settings.last_generated_at)}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse">
              <div className="h-6 w-64 bg-card-border rounded mb-3" />
              <div className="h-4 w-full bg-card-border rounded mb-2" />
              <div className="h-4 w-3/4 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : !displayBriefing ? (
        <EmptyState
          message="No briefings yet. Click 'Generate Now' to create your first daily intelligence briefing, or enable auto-briefing in Settings."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main briefing content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Hero card */}
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs text-muted">{formatDate(displayBriefing.briefing_date)}</span>
                  <h2 className="text-xl font-bold text-foreground mt-1">{displayBriefing.title}</h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {displayBriefing.ai_model_used && (
                    <span className="px-2 py-1 rounded bg-card-hover">{displayBriefing.ai_model_used}</span>
                  )}
                  <span>{formatTime(displayBriefing.generated_at)}</span>
                </div>
              </div>
              <p className="text-sm text-muted leading-relaxed">{displayBriefing.summary}</p>
              {displayBriefing.domains_analyzed && displayBriefing.domains_analyzed.length > 0 && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs text-muted">Domains:</span>
                  {displayBriefing.domains_analyzed.map((d) => (
                    <span key={d} className="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">{d}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Sections */}
            {parseSections(displayBriefing).map((section) => (
              <BriefingSection key={section.type} section={section} />
            ))}
          </div>

          {/* Sidebar — History */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden sticky top-4">
              <div className="px-4 py-3 border-b border-card-border">
                <h3 className="text-sm font-semibold text-foreground">Briefing History</h3>
              </div>
              <div className="divide-y divide-card-border max-h-[600px] overflow-y-auto">
                {briefings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBriefing(b)}
                    className={`w-full text-left px-4 py-3 hover:bg-card-hover transition-colors ${
                      displayBriefing?.id === b.id ? "bg-accent/5 border-l-2 border-l-accent" : ""
                    }`}
                  >
                    <p className="text-xs text-muted">{formatDate(b.briefing_date)}</p>
                    <p className="text-sm text-foreground font-medium truncate mt-0.5">{b.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs ${b.status === "completed" ? "text-green-400" : b.status === "failed" ? "text-red-400" : "text-yellow-400"}`}>
                        {b.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(b.id);
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </button>
                ))}
                {briefings.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted">
                    No briefings yet
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            {latestBriefing && (
              <div className="rounded-xl border border-card-border bg-card-bg p-4 mt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Quick Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Total Briefings</span>
                    <span className="text-foreground font-medium">{briefings.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Sections Today</span>
                    <span className="text-foreground font-medium">{parseSections(latestBriefing).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Tokens Used</span>
                    <span className="text-foreground font-medium">{latestBriefing.tokens_used?.toLocaleString() ?? 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Briefing Settings">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-foreground">Enable Auto-Briefing</label>
              <p className="text-xs text-muted mt-0.5">Generate a briefing automatically every day</p>
            </div>
            <button
              onClick={() => setFormEnabled(!formEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formEnabled ? "bg-accent" : "bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Timezone</label>
            <select
              value={formTimezone}
              onChange={(e) => setFormTimezone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Briefing Hour (0-23)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={formHour}
              onChange={(e) => setFormHour(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-muted mt-1">
              Briefing will generate at {formHour}:00 in {formTimezone || "your timezone"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Focus Keywords</label>
            <input
              type="text"
              value={formKeywords}
              onChange={(e) => setFormKeywords(e.target.value)}
              placeholder="e.g. planners, printables, AI tools"
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-muted mt-1">Comma-separated keywords to focus the AI research on</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-card-border text-foreground hover:bg-card-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
