import { Hono } from "hono";
import type { ApiResponse, SeasonalEvent } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const seasonalCalendar = new Hono<{ Bindings: RouterEnv }>();

// Pre-loaded global events data
const DEFAULT_EVENTS: Array<Omit<SeasonalEvent, "id" | "created_at" | "days_until" | "prep_start">> = [
  { name: "New Year", description: "New Year celebrations worldwide", event_date: "01-01", recurring: true, regions: ["GLOBAL"], categories: ["planners", "journals", "wall-art"], keywords: ["new year", "2026", "resolution", "goals"], prep_weeks: 6, priority: "high", is_active: true, auto_trigger: false },
  { name: "Valentine's Day", description: "Romantic gifts and cards", event_date: "02-14", recurring: true, regions: ["US", "UK", "EU", "CA", "AU"], categories: ["cards", "wall-art", "gifts", "stickers"], keywords: ["valentine", "love", "romantic", "couple", "heart"], prep_weeks: 5, priority: "high", is_active: true, auto_trigger: false },
  { name: "Ramadan", description: "Islamic holy month — varies yearly", event_date: "03-01", recurring: true, regions: ["MENA", "SEA", "UK", "US"], categories: ["planners", "journals", "wall-art", "stickers"], keywords: ["ramadan", "islamic", "eid", "iftar", "muslim"], prep_weeks: 6, priority: "high", is_active: true, auto_trigger: false },
  { name: "Mother's Day (US)", description: "Mother's Day in US", event_date: "05-11", recurring: true, regions: ["US", "CA", "AU"], categories: ["cards", "wall-art", "gifts", "journals"], keywords: ["mother", "mom", "mum", "mothers day", "parent"], prep_weeks: 5, priority: "high", is_active: true, auto_trigger: false },
  { name: "Mother's Day (UK)", description: "Mother's Day in UK (Mothering Sunday)", event_date: "03-30", recurring: true, regions: ["UK"], categories: ["cards", "wall-art", "gifts"], keywords: ["mother", "mum", "mothering sunday"], prep_weeks: 5, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Father's Day", description: "Father's Day celebration", event_date: "06-15", recurring: true, regions: ["US", "UK", "CA", "AU"], categories: ["cards", "wall-art", "gifts"], keywords: ["father", "dad", "fathers day", "parent"], prep_weeks: 5, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Back to School (US)", description: "Back to school season in the US", event_date: "08-15", recurring: true, regions: ["US", "CA"], categories: ["planners", "journals", "stickers", "trackers"], keywords: ["back to school", "student", "school", "academic", "study"], prep_weeks: 6, priority: "high", is_active: true, auto_trigger: false },
  { name: "Back to School (UK)", description: "Back to school season in UK", event_date: "09-01", recurring: true, regions: ["UK", "EU"], categories: ["planners", "journals", "stickers", "trackers"], keywords: ["back to school", "student", "school", "academic"], prep_weeks: 6, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Halloween", description: "Halloween celebration", event_date: "10-31", recurring: true, regions: ["US", "UK", "CA", "AU"], categories: ["stickers", "wall-art", "cards", "invitations"], keywords: ["halloween", "spooky", "scary", "costume", "trick or treat"], prep_weeks: 5, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Diwali", description: "Hindu festival of lights — varies yearly", event_date: "10-20", recurring: true, regions: ["IN", "UK", "US", "SEA"], categories: ["cards", "wall-art", "stickers", "invitations"], keywords: ["diwali", "deepavali", "festival of lights", "hindu"], prep_weeks: 5, priority: "high", is_active: true, auto_trigger: false },
  { name: "Black Friday", description: "Major shopping event", event_date: "11-28", recurring: true, regions: ["US", "UK", "CA", "EU", "AU"], categories: ["ALL"], keywords: ["black friday", "sale", "deal", "discount", "shopping"], prep_weeks: 4, priority: "high", is_active: true, auto_trigger: false },
  { name: "Christmas", description: "Christmas and holiday season", event_date: "12-25", recurring: true, regions: ["GLOBAL"], categories: ["cards", "wall-art", "gifts", "stickers", "planners"], keywords: ["christmas", "xmas", "holiday", "santa", "winter", "festive"], prep_weeks: 6, priority: "high", is_active: true, auto_trigger: false },
  { name: "Hanukkah", description: "Jewish Festival of Lights — varies yearly", event_date: "12-14", recurring: true, regions: ["US", "IL", "UK", "CA"], categories: ["cards", "wall-art", "stickers"], keywords: ["hanukkah", "chanukah", "jewish", "menorah"], prep_weeks: 5, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Chinese New Year", description: "Lunar New Year celebration", event_date: "01-29", recurring: true, regions: ["CN", "SEA", "US", "UK", "AU"], categories: ["cards", "wall-art", "stickers"], keywords: ["chinese new year", "lunar new year", "spring festival"], prep_weeks: 5, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Easter", description: "Easter celebration", event_date: "04-05", recurring: true, regions: ["US", "UK", "EU", "CA", "AU"], categories: ["cards", "stickers", "wall-art"], keywords: ["easter", "bunny", "spring", "egg"], prep_weeks: 4, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Thanksgiving (US)", description: "US Thanksgiving", event_date: "11-27", recurring: true, regions: ["US"], categories: ["cards", "wall-art", "planners"], keywords: ["thanksgiving", "grateful", "thankful", "fall", "autumn"], prep_weeks: 4, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Eid al-Fitr", description: "End of Ramadan celebration — varies yearly", event_date: "03-30", recurring: true, regions: ["MENA", "SEA", "UK", "US"], categories: ["cards", "wall-art", "stickers"], keywords: ["eid", "eid mubarak", "eid al fitr", "islamic"], prep_weeks: 4, priority: "high", is_active: true, auto_trigger: false },
  { name: "Teacher Appreciation Week", description: "Celebrate teachers", event_date: "05-05", recurring: true, regions: ["US"], categories: ["cards", "stickers", "wall-art"], keywords: ["teacher", "appreciation", "school", "educator"], prep_weeks: 4, priority: "low", is_active: true, auto_trigger: false },
  { name: "Graduation Season", description: "High school and college graduations", event_date: "06-01", recurring: true, regions: ["US", "UK", "CA", "AU"], categories: ["cards", "invitations", "wall-art", "gifts"], keywords: ["graduation", "grad", "diploma", "class of"], prep_weeks: 6, priority: "medium", is_active: true, auto_trigger: false },
  { name: "Wedding Season", description: "Peak wedding season", event_date: "06-15", recurring: true, regions: ["US", "UK", "EU", "AU"], categories: ["invitations", "cards", "planners", "stickers"], keywords: ["wedding", "bride", "groom", "bridal", "marriage"], prep_weeks: 8, priority: "medium", is_active: true, auto_trigger: false },
];

// GET /api/seasonal-calendar — list all events with days_until
seasonalCalendar.get("/", async (c) => {
  try {
    const events = await storageQuery<SeasonalEvent[]>(
      c.env,
      `SELECT * FROM seasonal_events ORDER BY event_date ASC`
    );

    const enriched = events.map((ev) => enrichEvent(ev));
    return c.json<ApiResponse>({ success: true, data: enriched });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/seasonal-calendar/seed — seed default events
seasonalCalendar.post("/seed", async (c) => {
  try {
    // Check if already seeded
    const existing = await storageQuery<Array<{ count: number }>>(
      c.env,
      `SELECT COUNT(*) as count FROM seasonal_events`
    );

    if (existing[0]?.count > 0) {
      return c.json<ApiResponse>({ success: true, data: { message: "Events already seeded", count: existing[0].count } });
    }

    let seeded = 0;
    for (const ev of DEFAULT_EVENTS) {
      const id = crypto.randomUUID();
      await storageQuery(
        c.env,
        `INSERT INTO seasonal_events (id, name, description, event_date, recurring, regions, categories, keywords, prep_weeks, priority, is_active, auto_trigger)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, ev.name, ev.description ?? null, ev.event_date,
          ev.recurring ? 1 : 0,
          JSON.stringify(ev.regions), JSON.stringify(ev.categories), JSON.stringify(ev.keywords),
          ev.prep_weeks, ev.priority, ev.is_active ? 1 : 0, ev.auto_trigger ? 1 : 0,
        ]
      );
      seeded++;
    }

    return c.json<ApiResponse>({ success: true, data: { seeded } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/seasonal-calendar — create custom event
seasonalCalendar.post("/", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      event_date: string;
      recurring?: boolean;
      regions?: string[];
      categories?: string[];
      keywords?: string[];
      prep_weeks?: number;
      priority?: string;
      auto_trigger?: boolean;
    }>();

    if (!body.name || !body.event_date) {
      return c.json<ApiResponse>({ success: false, error: "name and event_date are required" }, 400);
    }

    const id = crypto.randomUUID();
    await storageQuery(
      c.env,
      `INSERT INTO seasonal_events (id, name, description, event_date, recurring, regions, categories, keywords, prep_weeks, priority, auto_trigger)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.name, body.description ?? null, body.event_date,
        body.recurring !== false ? 1 : 0,
        body.regions ? JSON.stringify(body.regions) : null,
        body.categories ? JSON.stringify(body.categories) : null,
        body.keywords ? JSON.stringify(body.keywords) : null,
        body.prep_weeks ?? 5,
        body.priority ?? "medium",
        body.auto_trigger ? 1 : 0,
      ]
    );

    return c.json<ApiResponse>({ success: true, data: { id } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/seasonal-calendar/:id — update event
seasonalCalendar.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<Partial<SeasonalEvent>>();

    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); params.push(body.name); }
    if (body.description !== undefined) { fields.push("description = ?"); params.push(body.description); }
    if (body.event_date !== undefined) { fields.push("event_date = ?"); params.push(body.event_date); }
    if (body.recurring !== undefined) { fields.push("recurring = ?"); params.push(body.recurring ? 1 : 0); }
    if (body.regions !== undefined) { fields.push("regions = ?"); params.push(JSON.stringify(body.regions)); }
    if (body.categories !== undefined) { fields.push("categories = ?"); params.push(JSON.stringify(body.categories)); }
    if (body.keywords !== undefined) { fields.push("keywords = ?"); params.push(JSON.stringify(body.keywords)); }
    if (body.prep_weeks !== undefined) { fields.push("prep_weeks = ?"); params.push(body.prep_weeks); }
    if (body.priority !== undefined) { fields.push("priority = ?"); params.push(body.priority); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); params.push(body.is_active ? 1 : 0); }
    if (body.auto_trigger !== undefined) { fields.push("auto_trigger = ?"); params.push(body.auto_trigger ? 1 : 0); }

    if (fields.length === 0) {
      return c.json<ApiResponse>({ success: false, error: "No fields to update" }, 400);
    }

    params.push(id);
    await storageQuery(
      c.env,
      `UPDATE seasonal_events SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/seasonal-calendar/:id — delete an event
seasonalCalendar.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, `DELETE FROM seasonal_events WHERE id = ?`, [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/seasonal-calendar/upcoming — events with prep starting soon
seasonalCalendar.get("/upcoming", async (c) => {
  try {
    const events = await storageQuery<SeasonalEvent[]>(
      c.env,
      `SELECT * FROM seasonal_events WHERE is_active = 1 ORDER BY event_date ASC`
    );

    const now = new Date();
    const upcoming = events
      .map((ev) => enrichEvent(ev))
      .filter((ev) => {
        const daysUntil = ev.days_until ?? 999;
        const prepDays = (ev.prep_weeks ?? 5) * 7;
        return daysUntil > 0 && daysUntil <= prepDays;
      })
      .sort((a, b) => (a.days_until ?? 999) - (b.days_until ?? 999));

    return c.json<ApiResponse>({ success: true, data: upcoming });
  } catch (err) {
    return errorResponse(c, err);
  }
});

function enrichEvent(ev: SeasonalEvent): SeasonalEvent {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Parse event_date — could be MM-DD or YYYY-MM-DD
  let eventDate: Date;
  if (ev.event_date.length <= 5) {
    const [month, day] = ev.event_date.split("-").map(Number);
    eventDate = new Date(currentYear, month - 1, day);
    // If the date has passed this year, use next year
    if (eventDate < now) {
      eventDate = new Date(currentYear + 1, month - 1, day);
    }
  } else {
    eventDate = new Date(ev.event_date);
  }

  const diffMs = eventDate.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const prepStartDate = new Date(eventDate);
  prepStartDate.setDate(prepStartDate.getDate() - (ev.prep_weeks ?? 5) * 7);

  // Parse JSON fields
  const regions = typeof ev.regions === "string" ? JSON.parse(ev.regions as string) : ev.regions;
  const categories = typeof ev.categories === "string" ? JSON.parse(ev.categories as string) : ev.categories;
  const keywords = typeof ev.keywords === "string" ? JSON.parse(ev.keywords as string) : ev.keywords;

  return {
    ...ev,
    regions,
    categories,
    keywords,
    days_until: daysUntil,
    prep_start: prepStartDate.toISOString().split("T")[0],
  };
}

export default seasonalCalendar;
