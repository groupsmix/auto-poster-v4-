// ============================================================
// Seasonal Calendar Auto-Trigger Service
// Checks upcoming seasonal events and auto-creates products
// when prep_start date is reached and auto_trigger is enabled
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService } from "../helpers";

interface SeasonalEventRow {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  recurring: number;
  regions: string | null;
  categories: string | null;
  keywords: string | null;
  prep_weeks: number;
  priority: string;
  is_active: number;
  auto_trigger: number;
  last_triggered: string | null;
}

/**
 * Check for seasonal events whose prep window has started and auto_trigger is enabled.
 * For each qualifying event, start a workflow to create seasonal products.
 */
export async function checkSeasonalTriggers(env: RouterEnv): Promise<{
  triggered: number;
  events: Array<{ event_id: string; event_name: string; status: string }>;
}> {
  const events = (await storageQuery<SeasonalEventRow[]>(
    env,
    `SELECT * FROM seasonal_events WHERE is_active = 1 AND auto_trigger = 1`
  )) ?? [];

  const results: Array<{ event_id: string; event_name: string; status: string }> = [];
  let triggered = 0;
  const today = new Date();

  for (const event of events) {
    try {
      // Calculate if we're in the prep window
      const currentYear = today.getFullYear();
      let eventDate: Date;

      if (event.event_date.length <= 5) {
        const [month, day] = event.event_date.split("-").map(Number);
        eventDate = new Date(currentYear, month - 1, day);
        if (eventDate < today) {
          eventDate = new Date(currentYear + 1, month - 1, day);
        }
      } else {
        eventDate = new Date(event.event_date);
      }

      const prepDays = (event.prep_weeks ?? 5) * 7;
      const prepStartDate = new Date(eventDate);
      prepStartDate.setDate(prepStartDate.getDate() - prepDays);

      const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntilPrep = Math.ceil((prepStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Only trigger if we're in the prep window (prep has started but event hasn't passed)
      if (daysUntilPrep > 0 || daysUntilEvent <= 0) {
        continue;
      }

      // Check if already triggered this year
      if (event.last_triggered) {
        const lastTriggered = new Date(event.last_triggered);
        const daysSinceLastTrigger = Math.ceil(
          (today.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60 * 24)
        );
        // Don't re-trigger within 30 days
        if (daysSinceLastTrigger < 30) {
          results.push({
            event_id: event.id,
            event_name: event.name,
            status: "skipped: recently triggered",
          });
          continue;
        }
      }

      // Parse event keywords and categories for the workflow
      const keywords: string[] = event.keywords
        ? (typeof event.keywords === "string" ? JSON.parse(event.keywords) : event.keywords)
        : [];
      const categories: string[] = event.categories
        ? (typeof event.categories === "string" ? JSON.parse(event.categories) : event.categories)
        : [];

      // Find a matching domain/category for this seasonal event
      const niche = keywords.length > 0
        ? keywords.slice(0, 3).join(", ")
        : event.name.toLowerCase();

      // Get a domain to use (default to first active domain)
      const domainRows = (await storageQuery<Array<{ id: string }>>(
        env,
        `SELECT id FROM domains WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1`
      )) ?? [];

      if (domainRows.length === 0) {
        results.push({
          event_id: event.id,
          event_name: event.name,
          status: "skipped: no active domains",
        });
        continue;
      }

      const domainId = domainRows[0].id;

      // Find a category matching the event's categories
      let categoryId: string | null = null;
      if (categories.length > 0) {
        const catPlaceholders = categories.map(() => "?").join(",");
        const catRows = (await storageQuery<Array<{ id: string }>>(
          env,
          `SELECT id FROM categories WHERE domain_id = ? AND is_active = 1
           AND (${categories.map(() => "LOWER(name) LIKE ?").join(" OR ")})
           LIMIT 1`,
          [domainId, ...categories.map((c) => `%${c.toLowerCase()}%`)]
        )) ?? [];

        if (catRows.length > 0) {
          categoryId = catRows[0].id;
        }
      }

      // Fallback: pick random category from the domain
      if (!categoryId) {
        const catRows = (await storageQuery<Array<{ id: string }>>(
          env,
          `SELECT id FROM categories WHERE domain_id = ? AND is_active = 1 ORDER BY RANDOM() LIMIT 1`,
          [domainId]
        )) ?? [];
        if (catRows.length > 0) {
          categoryId = catRows[0].id;
        }
      }

      if (!categoryId) {
        results.push({
          event_id: event.id,
          event_name: event.name,
          status: "skipped: no matching category",
        });
        continue;
      }

      // Start a workflow for this seasonal event
      const workflowResult = await forwardToService(
        env.NEXUS_WORKFLOW,
        "/workflow/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain_id: domainId,
            category_id: categoryId,
            niche: `${event.name} - ${niche}`,
            language: "en",
            platforms: [],
            social_channels: [],
            batch_count: 1,
            auto_approve_threshold: event.priority === "high" ? 8 : 9,
          }),
        }
      );

      // Update last_triggered timestamp
      await storageQuery(
        env,
        `UPDATE seasonal_events SET last_triggered = ? WHERE id = ?`,
        [now(), event.id]
      );

      triggered++;
      results.push({
        event_id: event.id,
        event_name: event.name,
        status: workflowResult.success ? "triggered" : `failed: ${workflowResult.error}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        event_id: event.id,
        event_name: event.name,
        status: `error: ${msg}`,
      });
    }
  }

  return { triggered, events: results };
}
