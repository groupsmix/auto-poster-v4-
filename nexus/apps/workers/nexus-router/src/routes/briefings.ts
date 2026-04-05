// ============================================================
// /api/briefings — Daily Intelligence Briefing routes
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService, errorResponse } from "../helpers";

const briefings = new Hono<{ Bindings: RouterEnv }>();

// ── GET /api/briefings — list all briefings (newest first) ──

briefings.get("/", async (c) => {
  try {
    const limit = c.req.query("limit") ?? "20";
    const offset = c.req.query("offset") ?? "0";
    const data = await storageQuery(
      c.env,
      `SELECT * FROM daily_briefings ORDER BY generated_at DESC LIMIT ? OFFSET ?`,
      [parseInt(limit, 10), parseInt(offset, 10)]
    );
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ── GET /api/briefings/latest — get the most recent briefing ──

briefings.get("/latest", async (c) => {
  try {
    const results = await storageQuery<Record<string, unknown>[]>(
      c.env,
      `SELECT * FROM daily_briefings WHERE status = 'completed' ORDER BY generated_at DESC LIMIT 1`
    );
    if (!results || results.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No briefings found" },
        404
      );
    }

    // Parse JSON fields
    const briefing = results[0];
    if (typeof briefing.sections === "string") {
      briefing.sections = JSON.parse(briefing.sections as string);
    }
    if (typeof briefing.domains_analyzed === "string") {
      briefing.domains_analyzed = JSON.parse(briefing.domains_analyzed as string);
    }
    if (typeof briefing.focus_keywords === "string") {
      briefing.focus_keywords = JSON.parse(briefing.focus_keywords as string);
    }

    return c.json<ApiResponse>({ success: true, data: briefing });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ── GET /api/briefings/settings — get briefing settings ──

briefings.get("/settings", async (c) => {
  try {
    const results = await storageQuery<Record<string, unknown>[]>(
      c.env,
      `SELECT * FROM briefing_settings WHERE id = 'default' LIMIT 1`
    );

    if (!results || results.length === 0) {
      // Return defaults
      return c.json<ApiResponse>({
        success: true,
        data: {
          id: "default",
          user_timezone: "UTC",
          briefing_hour: 8,
          briefing_enabled: false,
          focus_domains: [],
          focus_keywords: [],
          briefing_types: ["trends", "predictions", "opportunities", "action_items", "niche_hacks"],
          last_generated_at: null,
        },
      });
    }

    const settings = results[0];
    // Parse JSON fields
    if (typeof settings.focus_domains === "string") {
      settings.focus_domains = JSON.parse(settings.focus_domains as string);
    }
    if (typeof settings.focus_keywords === "string") {
      settings.focus_keywords = JSON.parse(settings.focus_keywords as string);
    }
    if (typeof settings.briefing_types === "string") {
      settings.briefing_types = JSON.parse(settings.briefing_types as string);
    }
    // Convert SQLite integer boolean
    settings.briefing_enabled = Boolean(settings.briefing_enabled);

    return c.json<ApiResponse>({ success: true, data: settings });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ── PUT /api/briefings/settings — update briefing settings ──

briefings.put("/settings", async (c) => {
  try {
    const body = await c.req.json<{
      user_timezone?: string;
      briefing_hour?: number;
      briefing_enabled?: boolean;
      focus_domains?: string[];
      focus_keywords?: string[];
      briefing_types?: string[];
    }>();

    const ts = now();
    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.user_timezone !== undefined) {
      fields.push("user_timezone = ?");
      params.push(body.user_timezone);
    }
    if (body.briefing_hour !== undefined) {
      if (body.briefing_hour < 0 || body.briefing_hour > 23) {
        return c.json<ApiResponse>(
          { success: false, error: "briefing_hour must be between 0 and 23" },
          400
        );
      }
      fields.push("briefing_hour = ?");
      params.push(body.briefing_hour);
    }
    if (body.briefing_enabled !== undefined) {
      fields.push("briefing_enabled = ?");
      params.push(body.briefing_enabled ? 1 : 0);
    }
    if (body.focus_domains !== undefined) {
      fields.push("focus_domains = ?");
      params.push(JSON.stringify(body.focus_domains));
    }
    if (body.focus_keywords !== undefined) {
      fields.push("focus_keywords = ?");
      params.push(JSON.stringify(body.focus_keywords));
    }
    if (body.briefing_types !== undefined) {
      fields.push("briefing_types = ?");
      params.push(JSON.stringify(body.briefing_types));
    }

    if (fields.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No fields to update" },
        400
      );
    }

    fields.push("updated_at = ?");
    params.push(ts);
    params.push("default"); // WHERE id = ?

    await storageQuery(
      c.env,
      `UPDATE briefing_settings SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({
      success: true,
      data: { updated: true },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ── GET /api/briefings/:id — get a specific briefing ──

briefings.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const results = await storageQuery<Record<string, unknown>[]>(
      c.env,
      `SELECT * FROM daily_briefings WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!results || results.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Briefing not found" },
        404
      );
    }

    const briefing = results[0];
    if (typeof briefing.sections === "string") {
      briefing.sections = JSON.parse(briefing.sections as string);
    }
    if (typeof briefing.domains_analyzed === "string") {
      briefing.domains_analyzed = JSON.parse(briefing.domains_analyzed as string);
    }
    if (typeof briefing.focus_keywords === "string") {
      briefing.focus_keywords = JSON.parse(briefing.focus_keywords as string);
    }

    return c.json<ApiResponse>({ success: true, data: briefing });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ── DELETE /api/briefings/:id — delete a briefing ──

briefings.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(
      c.env,
      `DELETE FROM daily_briefings WHERE id = ?`,
      [id]
    );
    return c.json<ApiResponse>({ success: true, data: { deleted: id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ── POST /api/briefings/generate — manually trigger a briefing ──

briefings.post("/generate", async (c) => {
  try {
    // Get settings for focus areas
    const settingsResults = await storageQuery<Record<string, unknown>[]>(
      c.env,
      `SELECT * FROM briefing_settings WHERE id = 'default' LIMIT 1`
    );

    const settings = settingsResults?.[0];
    const focusDomains = settings?.focus_domains
      ? (typeof settings.focus_domains === "string"
        ? JSON.parse(settings.focus_domains as string) as string[]
        : settings.focus_domains as string[])
      : [];
    const focusKeywords = settings?.focus_keywords
      ? (typeof settings.focus_keywords === "string"
        ? JSON.parse(settings.focus_keywords as string) as string[]
        : settings.focus_keywords as string[])
      : [];
    const briefingTypes = settings?.briefing_types
      ? (typeof settings.briefing_types === "string"
        ? JSON.parse(settings.briefing_types as string) as string[]
        : settings.briefing_types as string[])
      : ["trends", "predictions", "opportunities", "action_items", "niche_hacks"];

    // Call nexus-ai to generate the briefing
    const aiResp = await forwardToService(
      c.env.NEXUS_AI,
      "/ai/briefing/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focus_domains: focusDomains,
          focus_keywords: focusKeywords,
          briefing_types: briefingTypes,
        }),
      }
    );

    if (!aiResp.success || !aiResp.data) {
      return c.json<ApiResponse>(
        { success: false, error: aiResp.error ?? "Briefing generation failed" },
        500
      );
    }

    const briefingData = aiResp.data as {
      title: string;
      summary: string;
      sections: unknown[];
      domains_analyzed: string[];
      ai_model_used: string;
      tokens_used: number;
    };

    // Store in D1
    const id = generateId();
    const briefingDate = new Date().toISOString().split("T")[0];
    const ts = now();

    await storageQuery(
      c.env,
      `INSERT INTO daily_briefings (id, briefing_date, title, summary, sections, domains_analyzed, focus_keywords, ai_model_used, tokens_used, status, generated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
      [
        id,
        briefingDate,
        briefingData.title,
        briefingData.summary,
        JSON.stringify(briefingData.sections),
        JSON.stringify(briefingData.domains_analyzed),
        JSON.stringify(focusKeywords),
        briefingData.ai_model_used,
        briefingData.tokens_used,
        ts,
        ts,
      ]
    );

    // Update last_generated_at in settings
    await storageQuery(
      c.env,
      `UPDATE briefing_settings SET last_generated_at = ?, updated_at = ? WHERE id = 'default'`,
      [ts, ts]
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        id,
        briefing_date: briefingDate,
        title: briefingData.title,
        summary: briefingData.summary,
        sections: briefingData.sections,
        domains_analyzed: briefingData.domains_analyzed,
        ai_model_used: briefingData.ai_model_used,
        tokens_used: briefingData.tokens_used,
        status: "completed",
        generated_at: ts,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default briefings;
