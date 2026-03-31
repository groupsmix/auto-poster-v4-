// ============================================================
// D1 Queries — PLATFORMS
// ============================================================

import type { Platform } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getPlatforms(db: D1Database): Promise<Platform[]> {
  const result = await db
    .prepare("SELECT id, name, slug, title_max_chars, tag_count, tag_max_chars, audience, tone, seo_style, description_style, cta_style, rules_json, is_active FROM platforms ORDER BY name ASC")
    .all<Platform>();
  return result.results;
}

export async function getPlatformById(db: D1Database, id: string): Promise<Platform | null> {
  return db
    .prepare("SELECT * FROM platforms WHERE id = ?")
    .bind(id)
    .first<Platform>();
}

export async function createPlatform(db: D1Database, platform: Platform): Promise<Platform> {
  await db
    .prepare(
      "INSERT INTO platforms (id, name, slug, title_max_chars, tag_count, tag_max_chars, audience, tone, seo_style, description_style, cta_style, rules_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      platform.id,
      platform.name,
      platform.slug,
      platform.title_max_chars ?? null,
      platform.tag_count ?? null,
      platform.tag_max_chars ?? null,
      platform.audience ?? null,
      platform.tone ?? null,
      platform.seo_style ?? null,
      platform.description_style ?? null,
      platform.cta_style ?? null,
      platform.rules_json ? JSON.stringify(platform.rules_json) : null,
      platform.is_active ? 1 : 0
    )
    .run();
  return platform;
}

export async function updatePlatform(
  db: D1Database,
  id: string,
  data: Partial<Omit<Platform, "id">>
): Promise<void> {
  await executeUpdate(db, "platforms", id, data as Record<string, unknown>, [
    { column: "name" },
    { column: "slug" },
    { column: "title_max_chars" },
    { column: "tag_count" },
    { column: "tag_max_chars" },
    { column: "audience" },
    { column: "tone" },
    { column: "seo_style" },
    { column: "description_style" },
    { column: "cta_style" },
    { column: "rules_json", transform: (v) => JSON.stringify(v) },
    { column: "is_active", transform: (v) => (v ? 1 : 0) },
  ]);
}

export async function deletePlatform(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM platforms WHERE id = ?").bind(id).run();
}
