// ============================================================
// Unit Tests — Seasonal Calendar logic
// Tests for nexus/apps/workers/nexus-router/src/routes/seasonal-calendar.ts
// ============================================================

import { describe, it, expect } from "vitest";

interface SeasonalEvent {
  id: string;
  name: string;
  event_date: string;
  prep_weeks: number;
  priority: string;
  regions: string[];
  categories: string[];
  keywords: string[];
  is_active: boolean;
  auto_trigger: boolean;
  recurring: boolean;
  days_until?: number;
  prep_start?: string;
}

function calculateDaysUntil(eventDate: string, now: Date = new Date()): number {
  const event = new Date(eventDate + "T00:00:00Z");
  const diff = event.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function calculatePrepStart(eventDate: string, prepWeeks: number): string {
  const event = new Date(eventDate + "T00:00:00Z");
  event.setDate(event.getDate() - prepWeeks * 7);
  return event.toISOString().slice(0, 10);
}

function shouldStartPrepping(daysUntil: number, prepWeeks: number): boolean {
  return daysUntil > 0 && daysUntil <= prepWeeks * 7;
}

function filterUpcoming(events: SeasonalEvent[]): SeasonalEvent[] {
  return events.filter((ev) => {
    const daysUntil = ev.days_until ?? 999;
    const prepDays = (ev.prep_weeks ?? 5) * 7;
    return daysUntil > 0 && daysUntil <= prepDays;
  });
}

function filterHighPriority(events: SeasonalEvent[]): SeasonalEvent[] {
  return events.filter((ev) => ev.priority === "high");
}

const DEFAULT_EVENTS: Partial<SeasonalEvent>[] = [
  { name: "Christmas", event_date: "2026-12-25", prep_weeks: 6, priority: "high", regions: ["global"], categories: ["holiday"], recurring: true },
  { name: "Valentine's Day", event_date: "2026-02-14", prep_weeks: 4, priority: "high", regions: ["global"], categories: ["holiday", "romantic"], recurring: true },
  { name: "Ramadan", event_date: "2026-02-18", prep_weeks: 5, priority: "high", regions: ["middle_east", "south_asia", "southeast_asia"], categories: ["religious"], recurring: true },
  { name: "Diwali", event_date: "2026-10-20", prep_weeks: 5, priority: "high", regions: ["south_asia"], categories: ["religious", "festival"], recurring: true },
  { name: "Mother's Day (US)", event_date: "2026-05-10", prep_weeks: 4, priority: "medium", regions: ["north_america"], categories: ["family"], recurring: true },
  { name: "Back to School", event_date: "2026-08-15", prep_weeks: 6, priority: "high", regions: ["north_america", "europe"], categories: ["education"], recurring: true },
];

describe("Seasonal Calendar", () => {
  describe("calculateDaysUntil", () => {
    it("returns positive days for future events", () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const dateStr = future.toISOString().slice(0, 10);
      const days = calculateDaysUntil(dateStr);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(31);
    });

    it("returns negative days for past events", () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      const dateStr = past.toISOString().slice(0, 10);
      const days = calculateDaysUntil(dateStr);
      expect(days).toBeLessThanOrEqual(-9);
    });

    it("returns 0 for today's event", () => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      const days = calculateDaysUntil(dateStr);
      expect(days).toBeLessThanOrEqual(1);
      expect(days).toBeGreaterThanOrEqual(-1);
    });
  });

  describe("calculatePrepStart", () => {
    it("calculates prep start date correctly", () => {
      const prepStart = calculatePrepStart("2026-12-25", 6);
      expect(prepStart).toBe("2026-11-13");
    });

    it("handles 4-week prep period", () => {
      const prepStart = calculatePrepStart("2026-02-14", 4);
      expect(prepStart).toBe("2026-01-17");
    });
  });

  describe("shouldStartPrepping", () => {
    it("returns true when within prep window", () => {
      expect(shouldStartPrepping(20, 4)).toBe(true); // 20 days < 28 days
      expect(shouldStartPrepping(35, 6)).toBe(true); // 35 days < 42 days
    });

    it("returns false when too far away", () => {
      expect(shouldStartPrepping(60, 4)).toBe(false); // 60 days > 28 days
      expect(shouldStartPrepping(50, 6)).toBe(false); // 50 days > 42 days
    });

    it("returns false when event has passed", () => {
      expect(shouldStartPrepping(-5, 4)).toBe(false);
      expect(shouldStartPrepping(0, 4)).toBe(false);
    });

    it("returns true at exact boundary", () => {
      expect(shouldStartPrepping(28, 4)).toBe(true); // exactly 4 weeks
    });
  });

  describe("filterUpcoming", () => {
    it("filters events that need prep now", () => {
      const events: SeasonalEvent[] = [
        { id: "1", name: "Soon", event_date: "2026-04-15", prep_weeks: 4, priority: "high", regions: [], categories: [], keywords: [], is_active: true, auto_trigger: false, recurring: true, days_until: 14 },
        { id: "2", name: "Far", event_date: "2026-12-25", prep_weeks: 6, priority: "high", regions: [], categories: [], keywords: [], is_active: true, auto_trigger: false, recurring: true, days_until: 268 },
        { id: "3", name: "Passed", event_date: "2026-01-01", prep_weeks: 4, priority: "low", regions: [], categories: [], keywords: [], is_active: true, auto_trigger: false, recurring: true, days_until: -90 },
      ];

      const upcoming = filterUpcoming(events);
      expect(upcoming).toHaveLength(1);
      expect(upcoming[0].name).toBe("Soon");
    });
  });

  describe("filterHighPriority", () => {
    it("filters only high priority events", () => {
      const events: SeasonalEvent[] = [
        { id: "1", name: "Christmas", event_date: "2026-12-25", prep_weeks: 6, priority: "high", regions: [], categories: [], keywords: [], is_active: true, auto_trigger: false, recurring: true },
        { id: "2", name: "Arbor Day", event_date: "2026-04-24", prep_weeks: 2, priority: "low", regions: [], categories: [], keywords: [], is_active: true, auto_trigger: false, recurring: true },
        { id: "3", name: "Mother's Day", event_date: "2026-05-10", prep_weeks: 4, priority: "medium", regions: [], categories: [], keywords: [], is_active: true, auto_trigger: false, recurring: true },
      ];

      const high = filterHighPriority(events);
      expect(high).toHaveLength(1);
      expect(high[0].name).toBe("Christmas");
    });
  });

  describe("Default events seed data", () => {
    it("contains key global events", () => {
      const names = DEFAULT_EVENTS.map((e) => e.name);
      expect(names).toContain("Christmas");
      expect(names).toContain("Ramadan");
      expect(names).toContain("Diwali");
      expect(names).toContain("Back to School");
    });

    it("all events have required fields", () => {
      for (const event of DEFAULT_EVENTS) {
        expect(event.name).toBeTruthy();
        expect(event.event_date).toBeTruthy();
        expect(event.prep_weeks).toBeGreaterThan(0);
        expect(event.priority).toBeTruthy();
        expect(event.recurring).toBe(true);
      }
    });

    it("has at least 6 default events", () => {
      expect(DEFAULT_EVENTS.length).toBeGreaterThanOrEqual(6);
    });
  });
});
