// ============================================================
// D1 Queries — PRODUCTS
// ============================================================

import type { Product } from "@nexus/shared";
import { now } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getProducts(db: D1Database): Promise<Product[]> {
  const result = await db
    .prepare("SELECT * FROM products ORDER BY created_at DESC")
    .all<Product>();
  return result.results;
}

export async function getProductById(db: D1Database, id: string): Promise<Product | null> {
  return db
    .prepare("SELECT * FROM products WHERE id = ?")
    .bind(id)
    .first<Product>();
}

export async function getProductsByDomain(db: D1Database, domainId: string): Promise<Product[]> {
  const result = await db
    .prepare("SELECT * FROM products WHERE domain_id = ? ORDER BY created_at DESC")
    .bind(domainId)
    .all<Product>();
  return result.results;
}

export async function getProductsByCategory(db: D1Database, categoryId: string): Promise<Product[]> {
  const result = await db
    .prepare("SELECT * FROM products WHERE category_id = ? ORDER BY created_at DESC")
    .bind(categoryId)
    .all<Product>();
  return result.results;
}

export async function getProductsByBatch(db: D1Database, batchId: string): Promise<Product[]> {
  const result = await db
    .prepare("SELECT * FROM products WHERE batch_id = ? ORDER BY created_at ASC")
    .bind(batchId)
    .all<Product>();
  return result.results;
}

export async function createProduct(
  db: D1Database,
  product: Omit<Product, "created_at" | "updated_at">
): Promise<Product> {
  const created_at = now();
  await db
    .prepare(
      "INSERT INTO products (id, domain_id, category_id, name, niche, language, user_input, batch_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      product.id,
      product.domain_id,
      product.category_id,
      product.name ?? null,
      product.niche ?? null,
      product.language,
      product.user_input ? JSON.stringify(product.user_input) : null,
      product.batch_id ?? null,
      product.status,
      created_at
    )
    .run();
  return { ...product, created_at, updated_at: undefined };
}

export async function updateProduct(
  db: D1Database,
  id: string,
  data: Partial<Omit<Product, "id" | "created_at">>
): Promise<void> {
  await executeUpdate(db, "products", id, data as Record<string, unknown>, [
    { column: "domain_id" },
    { column: "category_id" },
    { column: "name" },
    { column: "niche" },
    { column: "language" },
    { column: "user_input", transform: (v) => JSON.stringify(v) },
    { column: "batch_id" },
    { column: "status" },
  ], { autoUpdatedAt: true });
}

export async function deleteProduct(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
}
