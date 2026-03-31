// ============================================================
// AI CEO / Auto-Orchestrator Routes
//
// POST /api/ai-ceo/setup       — Run full CEO analysis for a domain+category
// GET  /api/ai-ceo/config/:id  — Get existing CEO config by category ID
// POST /api/ai-ceo/refresh/:id — Re-run CEO analysis for existing category
// GET  /api/ai-ceo/history     — List all CEO configurations
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import { generateId, slugify, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse, validateStringField } from "../helpers";

const aiCeo = new Hono<{ Bindings: RouterEnv }>();

// --- Types for CEO setup ---

interface CEOSetupBody {
  domain_id?: string;
  category_id?: string;
  niche_hint?: string;
  language?: string;
}

// POST /api/ai-ceo/setup — Run full CEO analysis
aiCeo.post("/setup", async (c) => {
  try {
    const body = await c.req.json<CEOSetupBody>();

    const domainId = validateStringField(body as Record<string, unknown>, "domain_id");
    const categoryId = validateStringField(body as Record<string, unknown>, "category_id");

    if (!domainId || !categoryId) {
      return c.json<ApiResponse>(
        { success: false, error: "domain_id and category_id are required" },
        400
      );
    }

    // Look up domain and category names/slugs from D1
    const domainRows = await storageQuery(
      c.env,
      "SELECT id, name, slug FROM domains WHERE id = ? LIMIT 1",
      [domainId]
    ) as Array<{ id: string; name: string; slug: string }>;

    if (!domainRows || domainRows.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: `Domain not found: ${domainId}` },
        404
      );
    }

    const categoryRows = await storageQuery(
      c.env,
      "SELECT id, name, slug FROM categories WHERE id = ? AND domain_id = ? LIMIT 1",
      [categoryId, domainId]
    ) as Array<{ id: string; name: string; slug: string }>;

    if (!categoryRows || categoryRows.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: `Category not found: ${categoryId}` },
        404
      );
    }

    const domain = domainRows[0];
    const category = categoryRows[0];

    // Forward to nexus-ai CEO setup endpoint
    const aiResp = await c.env.NEXUS_AI.fetch("http://nexus-ai/ai/ceo/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain_name: domain.name,
        domain_slug: domain.slug,
        category_name: category.name,
        category_slug: category.slug,
        niche_hint: body.niche_hint ?? null,
        language: body.language ?? "en",
      }),
    });

    const aiResult = (await aiResp.json()) as ApiResponse;

    if (!aiResult.success) {
      return c.json<ApiResponse>(
        { success: false, error: aiResult.error ?? "CEO setup failed" },
        500
      );
    }

    // Store CEO configuration in D1
    const configId = generateId();
    const ts = now();
    const analysisData = aiResult.data as {
      analysis: Record<string, unknown>;
      prompts_stored: number;
      kv_keys_written: string[];
    };

    await storageQuery(
      c.env,
      `INSERT INTO ceo_configurations
         (id, domain_id, category_id, analysis, prompts_stored, kv_keys, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        configId,
        domainId,
        categoryId,
        JSON.stringify(analysisData.analysis),
        analysisData.prompts_stored,
        JSON.stringify(analysisData.kv_keys_written),
        ts,
        ts,
      ]
    );

    // Also store the generated prompts in the prompt_templates table
    const analysis = analysisData.analysis as {
      generated_prompts?: {
        domain_prompt?: string;
        category_prompt?: string;
        role_overrides?: Record<string, string>;
      };
    };
    const prompts = analysis.generated_prompts;
    if (prompts) {
      // Domain prompt
      if (prompts.domain_prompt) {
        await upsertPromptTemplate(
          c.env,
          "domain",
          domain.slug,
          `${domain.name} Domain Prompt`,
          prompts.domain_prompt
        );
      }

      // Category prompt
      if (prompts.category_prompt) {
        await upsertPromptTemplate(
          c.env,
          "category",
          category.slug,
          `${category.name} Category Prompt`,
          prompts.category_prompt
        );
      }

      // Role overrides
      if (prompts.role_overrides) {
        for (const [role, prompt] of Object.entries(prompts.role_overrides)) {
          await upsertPromptTemplate(
            c.env,
            "role",
            `${role}:${category.slug}`,
            `${role} Role Override for ${category.name}`,
            prompt
          );
        }
      }
    }

    return c.json<ApiResponse>(
      {
        success: true,
        data: {
          config_id: configId,
          domain: domain.name,
          category: category.name,
          analysis: analysisData.analysis,
          prompts_stored: analysisData.prompts_stored,
          kv_keys_written: analysisData.kv_keys_written,
        },
      },
      201
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/ai-ceo/config/:id — Get CEO config by category ID
aiCeo.get("/config/:id", async (c) => {
  try {
    const categoryId = c.req.param("id");

    const rows = await storageQuery(
      c.env,
      `SELECT c.*, d.name as domain_name, cat.name as category_name
       FROM ceo_configurations c
       LEFT JOIN domains d ON c.domain_id = d.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.category_id = ? AND c.status = 'active'
       ORDER BY c.updated_at DESC
       LIMIT 1`,
      [categoryId]
    ) as Array<Record<string, unknown>>;

    if (!rows || rows.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No CEO configuration found for this category" },
        404
      );
    }

    const row = rows[0];
    // Parse JSON fields
    if (typeof row.analysis === "string") {
      try { row.analysis = JSON.parse(row.analysis as string); } catch { /* keep as string */ }
    }
    if (typeof row.kv_keys === "string") {
      try { row.kv_keys = JSON.parse(row.kv_keys as string); } catch { /* keep as string */ }
    }

    return c.json<ApiResponse>({ success: true, data: row });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/ai-ceo/refresh/:id — Re-run CEO analysis for a category
aiCeo.post("/refresh/:id", async (c) => {
  try {
    const categoryId = c.req.param("id");
    const body = await c.req.json<{ niche_hint?: string; language?: string }>().catch(() => ({} as { niche_hint?: string; language?: string }));

    // Look up category and its domain
    const categoryRows = await storageQuery(
      c.env,
      "SELECT c.id, c.name, c.slug, c.domain_id, d.name as domain_name, d.slug as domain_slug FROM categories c LEFT JOIN domains d ON c.domain_id = d.id WHERE c.id = ? LIMIT 1",
      [categoryId]
    ) as Array<{ id: string; name: string; slug: string; domain_id: string; domain_name: string; domain_slug: string }>;

    if (!categoryRows || categoryRows.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: `Category not found: ${categoryId}` },
        404
      );
    }

    const cat = categoryRows[0];

    // Mark old config as superseded
    await storageQuery(
      c.env,
      "UPDATE ceo_configurations SET status = 'superseded', updated_at = ? WHERE category_id = ? AND status = 'active'",
      [now(), categoryId]
    );

    // Forward to nexus-ai CEO setup endpoint
    const aiResp = await c.env.NEXUS_AI.fetch("http://nexus-ai/ai/ceo/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain_name: cat.domain_name,
        domain_slug: cat.domain_slug,
        category_name: cat.name,
        category_slug: cat.slug,
        niche_hint: body.niche_hint ?? null,
        language: body.language ?? "en",
      }),
    });

    const aiResult = (await aiResp.json()) as ApiResponse;

    if (!aiResult.success) {
      return c.json<ApiResponse>(
        { success: false, error: aiResult.error ?? "CEO refresh failed" },
        500
      );
    }

    // Store new CEO configuration
    const configId = generateId();
    const ts = now();
    const analysisData = aiResult.data as {
      analysis: Record<string, unknown>;
      prompts_stored: number;
      kv_keys_written: string[];
    };

    await storageQuery(
      c.env,
      `INSERT INTO ceo_configurations
         (id, domain_id, category_id, analysis, prompts_stored, kv_keys, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        configId,
        cat.domain_id,
        categoryId,
        JSON.stringify(analysisData.analysis),
        analysisData.prompts_stored,
        JSON.stringify(analysisData.kv_keys_written),
        ts,
        ts,
      ]
    );

    // Update prompt_templates
    const analysis = analysisData.analysis as {
      generated_prompts?: {
        domain_prompt?: string;
        category_prompt?: string;
        role_overrides?: Record<string, string>;
      };
    };
    const prompts = analysis.generated_prompts;
    if (prompts) {
      if (prompts.domain_prompt) {
        await upsertPromptTemplate(
          c.env,
          "domain",
          cat.domain_slug,
          `${cat.domain_name} Domain Prompt`,
          prompts.domain_prompt
        );
      }
      if (prompts.category_prompt) {
        await upsertPromptTemplate(
          c.env,
          "category",
          cat.slug,
          `${cat.name} Category Prompt`,
          prompts.category_prompt
        );
      }
      if (prompts.role_overrides) {
        for (const [role, prompt] of Object.entries(prompts.role_overrides)) {
          await upsertPromptTemplate(
            c.env,
            "role",
            `${role}:${cat.slug}`,
            `${role} Role Override for ${cat.name}`,
            prompt
          );
        }
      }
    }

    return c.json<ApiResponse>({
      success: true,
      data: {
        config_id: configId,
        domain: cat.domain_name,
        category: cat.name,
        analysis: analysisData.analysis,
        prompts_stored: analysisData.prompts_stored,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/ai-ceo/history — List all CEO configurations
aiCeo.get("/history", async (c) => {
  try {
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "20", 10);
    const offset = (page - 1) * pageSize;

    const rows = await storageQuery(
      c.env,
      `SELECT c.id, c.domain_id, c.category_id, c.prompts_stored, c.status, c.created_at, c.updated_at,
              d.name as domain_name, cat.name as category_name
       FROM ceo_configurations c
       LEFT JOIN domains d ON c.domain_id = d.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    const countResult = await storageQuery(
      c.env,
      "SELECT COUNT(*) as total FROM ceo_configurations",
      []
    ) as Array<{ total: number }>;

    const total = countResult?.[0]?.total ?? 0;

    return c.json<ApiResponse>({
      success: true,
      data: rows,
      ...(total !== undefined ? { total, page, pageSize } : {}),
    } as ApiResponse);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// HELPER: Upsert a prompt template in D1
// ============================================================

async function upsertPromptTemplate(
  env: RouterEnv,
  layer: string,
  targetId: string,
  name: string,
  prompt: string
): Promise<void> {
  const ts = now();

  // Check if a template already exists for this layer + target_id
  const existing = await storageQuery(
    env,
    "SELECT id, version FROM prompt_templates WHERE layer = ? AND target_id = ? AND is_active = 1 LIMIT 1",
    [layer, targetId]
  ) as Array<{ id: string; version: number }>;

  if (existing && existing.length > 0) {
    // Update existing template, increment version
    await storageQuery(
      env,
      "UPDATE prompt_templates SET prompt = ?, name = ?, version = version + 1, updated_at = ? WHERE id = ?",
      [prompt, name, ts, existing[0].id]
    );
  } else {
    // Insert new template
    const id = generateId();
    await storageQuery(
      env,
      `INSERT INTO prompt_templates (id, layer, target_id, name, prompt, version, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
      [id, layer, targetId, name, prompt, ts]
    );
  }
}

export default aiCeo;
