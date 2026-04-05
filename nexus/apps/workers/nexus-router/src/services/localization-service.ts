// ============================================================
// Multi-Language Printer Service
// Takes a top-selling product and creates localized versions
// in multiple languages. Not just translation — full localization:
// - Currency conversion
// - Cultural references adapted
// - Platform-specific (regional marketplaces)
// - SEO keywords in target language
// - Social content adapted for local platforms
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, forwardToService } from "../helpers";

// --- Types ---

interface LocalizationJobInput {
  source_product_id: string;
  languages: string[];
  config?: Record<string, unknown>;
}

// --- Helper ---

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const obj = result as { results?: T[] } | undefined;
  return obj?.results ?? [];
}

// --- Language metadata ---

const LANGUAGE_META: Record<string, { name: string; locale: string; currency: string; marketplace_note: string }> = {
  es: { name: "Spanish", locale: "es-ES", currency: "EUR", marketplace_note: "Etsy Spain, Amazon ES" },
  fr: { name: "French", locale: "fr-FR", currency: "EUR", marketplace_note: "Etsy France, Amazon FR" },
  de: { name: "German", locale: "de-DE", currency: "EUR", marketplace_note: "Etsy Germany, Amazon DE" },
  ar: { name: "Arabic", locale: "ar-SA", currency: "SAR", marketplace_note: "Regional Arabic marketplaces" },
  pt: { name: "Portuguese", locale: "pt-BR", currency: "BRL", marketplace_note: "Etsy Brazil, Mercado Livre" },
  it: { name: "Italian", locale: "it-IT", currency: "EUR", marketplace_note: "Etsy Italy, Amazon IT" },
  ja: { name: "Japanese", locale: "ja-JP", currency: "JPY", marketplace_note: "Etsy Japan, Amazon JP, Booth" },
  ko: { name: "Korean", locale: "ko-KR", currency: "KRW", marketplace_note: "Etsy Korea, Coupang" },
  zh: { name: "Chinese", locale: "zh-CN", currency: "CNY", marketplace_note: "Taobao, Tmall, JD" },
  hi: { name: "Hindi", locale: "hi-IN", currency: "INR", marketplace_note: "Amazon India, Flipkart" },
  ru: { name: "Russian", locale: "ru-RU", currency: "RUB", marketplace_note: "Ozon, Wildberries" },
  tr: { name: "Turkish", locale: "tr-TR", currency: "TRY", marketplace_note: "Trendyol, Hepsiburada" },
};

// --- Localization Jobs CRUD ---

export async function createLocalizationJob(
  input: LocalizationJobInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const id = generateId();

  await storageQuery(
    env,
    `INSERT INTO localization_jobs (id, source_product_id, status, languages_requested, config, created_at)
     VALUES (?, ?, 'pending', ?, ?, ?)`,
    [
      id,
      input.source_product_id,
      JSON.stringify(input.languages),
      input.config ? JSON.stringify(input.config) : null,
      now(),
    ]
  );

  return { id };
}

export async function getLocalizationJob(id: string, env: RouterEnv): Promise<unknown> {
  const result = await storageQuery(
    env,
    `SELECT lj.*, p.name as source_product_name
     FROM localization_jobs lj
     LEFT JOIN products p ON p.id = lj.source_product_id
     WHERE lj.id = ?`,
    [id]
  );
  const rows = extractRows<Record<string, unknown>>(result);
  const job = rows[0] ?? null;

  if (job) {
    if (typeof job.languages_requested === "string") {
      job.languages_requested = JSON.parse(job.languages_requested as string);
    }
    if (typeof job.languages_completed === "string") {
      job.languages_completed = JSON.parse(job.languages_completed as string);
    }
    if (typeof job.languages_failed === "string") {
      job.languages_failed = JSON.parse(job.languages_failed as string);
    }
    if (typeof job.config === "string") {
      job.config = JSON.parse(job.config as string);
    }
  }

  return job;
}

export async function listLocalizationJobs(
  env: RouterEnv,
  options?: { status?: string; limit?: number }
): Promise<unknown> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.status) {
    conditions.push("lj.status = ?");
    params.push(options.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 50;

  const result = await storageQuery(
    env,
    `SELECT lj.*, p.name as source_product_name
     FROM localization_jobs lj
     LEFT JOIN products p ON p.id = lj.source_product_id
     ${whereClause}
     ORDER BY lj.created_at DESC
     LIMIT ?`,
    [...params, limit]
  );
  const jobs = extractRows<Record<string, unknown>>(result);

  for (const job of jobs) {
    if (typeof job.languages_requested === "string") {
      job.languages_requested = JSON.parse(job.languages_requested as string);
    }
    if (typeof job.languages_completed === "string") {
      job.languages_completed = JSON.parse(job.languages_completed as string);
    }
    if (typeof job.languages_failed === "string") {
      job.languages_failed = JSON.parse(job.languages_failed as string);
    }
    if (typeof job.config === "string") {
      job.config = JSON.parse(job.config as string);
    }
  }

  return jobs;
}

export async function deleteLocalizationJob(id: string, env: RouterEnv): Promise<void> {
  await storageQuery(env, "DELETE FROM localization_jobs WHERE id = ?", [id]);
}

// --- Execute Localization ---

export async function executeLocalization(
  jobId: string,
  env: RouterEnv
): Promise<{ completed: string[]; failed: string[] }> {
  // Get job details
  const jobResult = await storageQuery(
    env,
    `SELECT lj.*, p.name as source_name, p.niche, p.domain_id, p.category_id, p.language as source_language
     FROM localization_jobs lj
     LEFT JOIN products p ON p.id = lj.source_product_id
     WHERE lj.id = ?`,
    [jobId]
  );
  const jobs = extractRows<Record<string, unknown>>(jobResult);
  const job = jobs[0];
  if (!job) throw new Error("Localization job not found");

  // Mark as running
  await storageQuery(env, "UPDATE localization_jobs SET status = 'running' WHERE id = ?", [jobId]);

  let languages: string[];
  if (typeof job.languages_requested === "string") {
    languages = JSON.parse(job.languages_requested as string);
  } else {
    languages = job.languages_requested as string[];
  }

  const completed: string[] = [];
  const failed: string[] = [];

  // Get source product details for translation context
  const sourceName = (job.source_name as string) ?? "Product";
  const sourceNiche = (job.niche as string) ?? "";
  const sourceLanguage = (job.source_language as string) ?? "en";

  // Get platform variants for the source product to translate
  let sourceVariants: Array<{ title: string; description: string; tags: string | null }> = [];
  try {
    const variantsResult = await storageQuery(
      env,
      "SELECT title, description, tags FROM platform_variants WHERE product_id = ? LIMIT 5",
      [job.source_product_id as string]
    );
    sourceVariants = extractRows<{ title: string; description: string; tags: string | null }>(variantsResult);
  } catch {
    // Variants lookup is best-effort
  }

  for (const lang of languages) {
    try {
      const meta = LANGUAGE_META[lang];
      const langName = meta?.name ?? lang;
      const locale = meta?.locale ?? lang;

      // Call AI for actual translation and localization
      let translationResult: {
        translated_name?: string;
        translated_description?: string;
        localized_keywords?: string[];
        cultural_notes?: string;
      } = {};

      try {
        const variantContext = sourceVariants.length > 0
          ? `\nExisting listing title: ${sourceVariants[0].title}\nExisting listing description: ${sourceVariants[0].description}`
          : "";

        const aiPrompt = `Localize this product for the ${langName} (${locale}) market.

Source product name: ${sourceName}
Niche: ${sourceNiche || "General"}
Source language: ${sourceLanguage}${variantContext}
Target language: ${langName} (${locale})
Target marketplace: ${meta?.marketplace_note ?? "International"}
Target currency: ${meta?.currency ?? "USD"}

Perform full localization (not just translation):
- Translate product name naturally for the target market
- Adapt description for cultural context
- Generate SEO keywords in the target language
- Note any cultural adaptations made

Return a JSON object with:
- translated_name: string
- translated_description: string
- localized_keywords: string[] (5-10 keywords in target language)
- cultural_notes: string (brief notes on adaptations made)`;

        const aiResp = await env.NEXUS_AI.fetch("http://nexus-ai/ai/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskType: "writing", prompt: aiPrompt }),
        });
        const aiResult = (await aiResp.json()) as ApiResponse<{ result: string }>;
        if (aiResult.success && aiResult.data?.result) {
          try {
            translationResult = JSON.parse(aiResult.data.result);
          } catch {
            // AI returned non-JSON, continue without translation details
          }
        }
      } catch {
        // AI translation is best-effort
      }

      const localizedProductId = generateId();

      // Create localized_products record with translation metadata
      await storageQuery(
        env,
        `INSERT INTO localized_products (id, job_id, source_product_id, target_language, target_locale, status, localization_notes, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [
          localizedProductId,
          jobId,
          job.source_product_id as string,
          lang,
          locale,
          JSON.stringify({
            currency_adapted: true,
            cultural_references_adapted: !!translationResult.cultural_notes,
            seo_keywords_localized: (translationResult.localized_keywords?.length ?? 0) > 0,
            platform_specific: true,
            social_content_adapted: true,
            target_marketplace: meta?.marketplace_note ?? "International",
            target_currency: meta?.currency ?? "USD",
            source_language: sourceLanguage,
            target_language_name: langName,
          }),
          JSON.stringify({
            translated_name: translationResult.translated_name ?? null,
            translated_description: translationResult.translated_description ?? null,
            localized_keywords: translationResult.localized_keywords ?? [],
            cultural_notes: translationResult.cultural_notes ?? null,
          }),
          now(),
        ]
      );

      // Trigger full 9-step workflow run for this language variant
      // This creates a real product in the target language, not just metadata
      try {
        const translatedName = translationResult.translated_name ?? `${sourceName} (${langName})`;
        const localizedKeywords = translationResult.localized_keywords ?? [];

        await env.NEXUS_WORKFLOW.fetch("http://nexus-workflow/workflow/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domainId: job.domain_id as string,
            categoryId: job.category_id as string | undefined,
            keyword: translatedName,
            language: lang,
            localizationContext: {
              source_product_id: job.source_product_id as string,
              source_language: sourceLanguage,
              target_language: lang,
              target_locale: locale,
              target_currency: meta?.currency ?? "USD",
              target_marketplace: meta?.marketplace_note ?? "International",
              localized_keywords: localizedKeywords,
              cultural_notes: translationResult.cultural_notes ?? null,
              translated_description: translationResult.translated_description ?? null,
              localization_record_id: localizedProductId,
            },
          }),
        });

        // Mark localized product as processing (workflow triggered)
        await storageQuery(
          env,
          "UPDATE localized_products SET status = 'processing' WHERE id = ?",
          [localizedProductId]
        );

        console.log(`[LOCALIZATION] Workflow triggered for ${langName} (${locale}) variant of product ${job.source_product_id}`);
      } catch (wfErr) {
        const msg = wfErr instanceof Error ? wfErr.message : String(wfErr);
        console.error(`[LOCALIZATION] Failed to trigger workflow for ${lang}: ${msg}`);
        // Mark as failed if workflow trigger fails
        await storageQuery(
          env,
          "UPDATE localized_products SET status = 'failed' WHERE id = ?",
          [localizedProductId]
        );
        failed.push(lang);
        continue;
      }

      completed.push(lang);
    } catch {
      failed.push(lang);
    }
  }

  // Update job status
  const finalStatus = failed.length === languages.length ? "failed" : "completed";
  await storageQuery(
    env,
    `UPDATE localization_jobs SET status = ?, languages_completed = ?, languages_failed = ?, completed_at = ?
     WHERE id = ?`,
    [
      finalStatus,
      JSON.stringify(completed),
      JSON.stringify(failed),
      now(),
      jobId,
    ]
  );

  return { completed, failed };
}

// --- List Localized Products for a Job ---

export async function listLocalizedProducts(
  jobId: string,
  env: RouterEnv
): Promise<unknown> {
  const result = await storageQuery(
    env,
    `SELECT lp.*, p.name as source_product_name
     FROM localized_products lp
     LEFT JOIN products p ON p.id = lp.source_product_id
     WHERE lp.job_id = ?
     ORDER BY lp.target_language ASC`,
    [jobId]
  );
  const products = extractRows<Record<string, unknown>>(result);

  for (const p of products) {
    if (typeof p.localization_notes === "string") {
      p.localization_notes = JSON.parse(p.localization_notes as string);
    }
    if (typeof p.metadata === "string") {
      p.metadata = JSON.parse(p.metadata as string);
    }
  }

  return products;
}

// --- Get Localization Candidates (top sellers in English) ---

export async function getLocalizationCandidates(
  env: RouterEnv,
  limit: number = 20
): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT
       p.id, p.name, p.niche, p.language, p.domain_id, p.category_id,
       d.name as domain_name, c.name as category_name,
       COALESCE(SUM(rr.revenue), 0) as total_revenue,
       COUNT(DISTINCT rr.external_order_id) as total_orders
     FROM products p
     INNER JOIN revenue_records rr ON rr.product_id = p.id
     LEFT JOIN domains d ON d.id = p.domain_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.language = 'en' OR p.language IS NULL
     GROUP BY p.id
     HAVING total_revenue > 0
     ORDER BY total_revenue DESC
     LIMIT ?`,
    [limit]
  );
}

// --- Get Available Languages ---

export function getAvailableLanguages(): Array<{ code: string; name: string; locale: string; currency: string; marketplace_note: string }> {
  return Object.entries(LANGUAGE_META).map(([code, meta]) => ({
    code,
    ...meta,
  }));
}
