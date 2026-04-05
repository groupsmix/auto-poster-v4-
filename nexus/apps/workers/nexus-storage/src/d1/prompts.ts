// ============================================================
// D1 Queries — PROMPT TEMPLATES
// ============================================================

import type { PromptTemplate } from "@nexus/shared";
import { now } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getPromptTemplates(db: D1Database, layer?: string): Promise<PromptTemplate[]> {
  if (layer) {
    const result = await db
      .prepare("SELECT id, layer, target_id, name, prompt, version, is_active, updated_at FROM prompt_templates WHERE layer = ? AND is_active = 1 ORDER BY name ASC")
      .bind(layer)
      .all<PromptTemplate>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT id, layer, target_id, name, prompt, version, is_active, updated_at FROM prompt_templates WHERE is_active = 1 ORDER BY layer, name ASC")
    .all<PromptTemplate>();
  return result.results;
}

export async function getPromptTemplateById(db: D1Database, id: string): Promise<PromptTemplate | null> {
  return db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first<PromptTemplate>();
}

export async function createPromptTemplate(
  db: D1Database,
  template: Omit<PromptTemplate, "updated_at">
): Promise<PromptTemplate> {
  const updated_at = now();
  await db
    .prepare(
      "INSERT INTO prompt_templates (id, layer, target_id, name, prompt, version, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      template.id,
      template.layer,
      template.target_id ?? null,
      template.name,
      template.prompt,
      template.version,
      template.is_active ? 1 : 0,
      updated_at
    )
    .run();
  return { ...template, updated_at };
}

export async function updatePromptTemplate(
  db: D1Database,
  id: string,
  data: Partial<Omit<PromptTemplate, "id">>
): Promise<void> {
  await executeUpdate(db, "prompt_templates", id, data as Record<string, unknown>, [
    { column: "layer" },
    { column: "target_id" },
    { column: "name" },
    { column: "prompt" },
    { column: "version" },
    { column: "is_active", transform: (v) => (v ? 1 : 0) },
  ], { autoUpdatedAt: true });
}

export async function deletePromptTemplate(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("DELETE FROM prompt_templates WHERE id = ?")
    .bind(id)
    .run();
}
