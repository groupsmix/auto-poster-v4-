// ============================================================
// D1 Queries — DOMAINS
// ============================================================

import type { Domain } from "@nexus/shared";
import { now } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getDomains(db: D1Database): Promise<Domain[]> {
  const result = await db
    .prepare("SELECT id, name, slug, description, icon, sort_order, is_active, created_at FROM domains ORDER BY sort_order ASC")
    .all<Domain>();
  return result.results;
}

export async function getDomainById(db: D1Database, id: string): Promise<Domain | null> {
  return db
    .prepare("SELECT * FROM domains WHERE id = ?")
    .bind(id)
    .first<Domain>();
}

export async function createDomain(db: D1Database, domain: Omit<Domain, "created_at">): Promise<Domain> {
  const created_at = now();
  await db
    .prepare(
      "INSERT INTO domains (id, name, slug, description, icon, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      domain.id,
      domain.name,
      domain.slug,
      domain.description ?? null,
      domain.icon ?? null,
      domain.sort_order,
      domain.is_active ? 1 : 0,
      created_at
    )
    .run();
  return { ...domain, created_at };
}

export async function updateDomain(
  db: D1Database,
  id: string,
  data: Partial<Omit<Domain, "id" | "created_at">>
): Promise<void> {
  await executeUpdate(db, "domains", id, data as Record<string, unknown>, [
    { column: "name" },
    { column: "slug" },
    { column: "description" },
    { column: "icon" },
    { column: "sort_order" },
    { column: "is_active", transform: (v) => (v ? 1 : 0) },
  ]);
}

export async function deleteDomain(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM domains WHERE id = ?").bind(id).run();
}
