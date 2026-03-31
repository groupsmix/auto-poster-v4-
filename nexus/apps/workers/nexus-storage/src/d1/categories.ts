// ============================================================
// D1 Queries — CATEGORIES
// ============================================================

import type { Category } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getCategories(db: D1Database, domainId?: string): Promise<Category[]> {
  if (domainId) {
    const result = await db
      .prepare("SELECT * FROM categories WHERE domain_id = ? ORDER BY sort_order ASC")
      .bind(domainId)
      .all<Category>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT * FROM categories ORDER BY sort_order ASC")
    .all<Category>();
  return result.results;
}

export async function getCategoryById(db: D1Database, id: string): Promise<Category | null> {
  return db
    .prepare("SELECT * FROM categories WHERE id = ?")
    .bind(id)
    .first<Category>();
}

export async function createCategory(db: D1Database, category: Category): Promise<Category> {
  await db
    .prepare(
      "INSERT INTO categories (id, domain_id, name, slug, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      category.id,
      category.domain_id,
      category.name,
      category.slug,
      category.description ?? null,
      category.sort_order,
      category.is_active ? 1 : 0
    )
    .run();
  return category;
}

export async function updateCategory(
  db: D1Database,
  id: string,
  data: Partial<Omit<Category, "id">>
): Promise<void> {
  await executeUpdate(db, "categories", id, data as Record<string, unknown>, [
    { column: "domain_id" },
    { column: "name" },
    { column: "slug" },
    { column: "description" },
    { column: "sort_order" },
    { column: "is_active", transform: (v) => (v ? 1 : 0) },
  ]);
}

export async function deleteCategory(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
}
