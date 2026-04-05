// ============================================================
// D1 Queries — ASSETS
// ============================================================

import type { Asset } from "@nexus/shared";
import { now } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getAssets(db: D1Database, productId?: string): Promise<Asset[]> {
  if (productId) {
    const result = await db
      .prepare("SELECT id, product_id, asset_type, r2_key, cf_image_id, url, metadata, created_at FROM assets WHERE product_id = ? ORDER BY created_at DESC")
      .bind(productId)
      .all<Asset>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT id, product_id, asset_type, r2_key, cf_image_id, url, metadata, created_at FROM assets ORDER BY created_at DESC")
    .all<Asset>();
  return result.results;
}

export async function getAssetById(db: D1Database, id: string): Promise<Asset | null> {
  return db
    .prepare("SELECT * FROM assets WHERE id = ?")
    .bind(id)
    .first<Asset>();
}

export async function createAsset(db: D1Database, asset: Omit<Asset, "created_at">): Promise<Asset> {
  const created_at = now();
  await db
    .prepare(
      "INSERT INTO assets (id, product_id, asset_type, r2_key, cf_image_id, url, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      asset.id,
      asset.product_id,
      asset.asset_type,
      asset.r2_key,
      asset.cf_image_id ?? null,
      asset.url,
      asset.metadata ? JSON.stringify(asset.metadata) : null,
      created_at
    )
    .run();
  return { ...asset, created_at };
}

export async function updateAsset(
  db: D1Database,
  id: string,
  data: Partial<Omit<Asset, "id" | "created_at">>
): Promise<void> {
  await executeUpdate(db, "assets", id, data as Record<string, unknown>, [
    { column: "product_id" },
    { column: "asset_type" },
    { column: "r2_key" },
    { column: "cf_image_id" },
    { column: "url" },
    { column: "metadata", transform: (v) => JSON.stringify(v) },
  ]);
}

export async function deleteAsset(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM assets WHERE id = ?").bind(id).run();
}
