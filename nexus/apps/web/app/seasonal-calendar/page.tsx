"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { SeasonalEvent } from "@/lib/api";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  low: "bg-blue-500/10 text-blue-400",
};

function DaysUntilBadge({ days }: { days: number | undefined }) {
  if (days === undefined) return null;
  if (days <= 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Passed</span>;
  if (days <= 14) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{days}d away</span>;
  if (days <= 42) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{days}d away</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">{days}d away</span>;
}

export default function SeasonalCalendarPage() {
  const { data: events, loading, refetch } = useApiQuery(
    () => api.seasonalCalendar.list(),
    [] as SeasonalEvent[],
  );

  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState<"all" | "upcoming" | "high">("all");

  async function handleSeed() {
    setSeeding(true);
    await api.seasonalCalendar.seed();
    setSeeding(false);
    refetch();
  }

  async function handleToggle(id: string, currentActive: boolean) {
    await api.seasonalCalendar.update(id, { is_active: !currentActive });
    refetch();
  }

  async function handleToggleAutoTrigger(id: string, current: boolean) {
    await api.seasonalCalendar.update(id, { auto_trigger: !current });
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event?")) return;
    await api.seasonalCalendar.delete(id);
    refetch();
  }

  const filteredEvents = events.filter((ev) => {
    if (filter === "upcoming") {
      const daysUntil = ev.days_until ?? 999;
      const prepDays = (ev.prep_weeks ?? 5) * 7;
      return daysUntil > 0 && daysUntil <= prepDays;
    }
    if (filter === "high") return ev.priority === "high";
    return true;
  });

  // Sort by days_until
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => (a.days_until ?? 999) - (b.days_until ?? 999)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Seasonal Calendar</h1>
          <p className="text-muted text-sm mt-1">
            Pre-loaded global events — auto-start product creation 4-6 weeks before each event
          </p>
        </div>
        {events.length === 0 && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {seeding ? "Seeding..." : "Seed Default Events"}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        {(["all", "upcoming", "high"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              filter === f
                ? "bg-accent text-white"
                : "bg-card-border text-muted hover:text-foreground"
            }`}
          >
            {f === "all" ? "All Events" : f === "upcoming" ? "Prep Now" : "High Priority"}
          </button>
        ))}
        <span className="text-xs text-muted ml-2">{sortedEvents.length} events</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
              <div className="h-4 w-48 bg-card-border rounded mb-2" />
              <div className="h-3 w-72 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="text-muted">
            {events.length === 0
              ? "No events loaded. Click \"Seed Default Events\" to load 20+ global events."
              : "No events match this filter."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((ev) => {
            const isPrepTime = (ev.days_until ?? 999) > 0 && (ev.days_until ?? 999) <= (ev.prep_weeks ?? 5) * 7;
            return (
              <div
                key={ev.id}
                className={`rounded-xl border bg-card-bg p-5 ${
                  isPrepTime ? "border-accent/50" : "border-card-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{ev.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ev.priority] ?? "bg-card-border text-muted"}`}>
                        {ev.priority}
                      </span>
                      <DaysUntilBadge days={ev.days_until} />
                      {isPrepTime && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                          START CREATING NOW
                        </span>
                      )}
                      {!ev.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Disabled</span>
                      )}
                    </div>
                    {ev.description && (
                      <p className="text-xs text-muted mt-1">{ev.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                      <span>Date: {ev.event_date}</span>
                      <span>Prep: {ev.prep_weeks}w before</span>
                      {ev.prep_start && <span>Prep starts: {ev.prep_start}</span>}
                      {ev.recurring && <span>Recurring</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(ev.regions ?? []).map((r) => (
                        <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{r}</span>
                      ))}
                      {(ev.categories ?? []).map((c) => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{c}</span>
                      ))}
                    </div>
                    {ev.keywords && ev.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ev.keywords.map((k) => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-card-border text-muted">{k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleAutoTrigger(ev.id, ev.auto_trigger)}
                      className={`px-3 py-1.5 text-xs rounded-lg ${
                        ev.auto_trigger
                          ? "bg-accent/10 text-accent"
                          : "bg-card-border text-muted"
                      }`}
                      title={ev.auto_trigger ? "Auto-trigger ON" : "Auto-trigger OFF"}
                    >
                      {ev.auto_trigger ? "Auto" : "Manual"}
                    </button>
                    <button
                      onClick={() => handleToggle(ev.id, ev.is_active)}
                      className="px-3 py-1.5 text-xs bg-card-border text-foreground rounded-lg hover:opacity-80"
                    >
                      {ev.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:opacity-80"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
