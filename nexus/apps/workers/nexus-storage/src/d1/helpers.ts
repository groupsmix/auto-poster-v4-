// ============================================================
// D1 Queries — Cross-entity helpers
// ============================================================

import type { Asset } from "@nexus/shared";

/** Get all product IDs for a domain (for cascading deletion) */
export async function getProductIdsByDomain(db: D1Database, domainId: string): Promise<string[]> {
  const result = await db
    .prepare("SELECT id FROM products WHERE domain_id = ?")
    .bind(domainId)
    .all<{ id: string }>();
  return result.results.map((r) => r.id);
}

/** Get all product IDs for a category (for cascading deletion) */
export async function getProductIdsByCategory(db: D1Database, categoryId: string): Promise<string[]> {
  const result = await db
    .prepare("SELECT id FROM products WHERE category_id = ?")
    .bind(categoryId)
    .all<{ id: string }>();
  return result.results.map((r) => r.id);
}

/** Get all assets for a product (for cleanup — need R2 keys + CF Image IDs) */
export async function getAssetsByProduct(db: D1Database, productId: string): Promise<Asset[]> {
  const result = await db
    .prepare("SELECT * FROM assets WHERE product_id = ?")
    .bind(productId)
    .all<Asset>();
  return result.results;
}
