// ============================================================
// D1 Queries — PLATFORM VARIANTS & SOCIAL VARIANTS
// ============================================================

import type { PlatformVariant, SocialVariant } from "@nexus/shared";
import { DEFAULT_PAGE_SIZE } from "@nexus/shared";
import { executeUpdate } from "./base";

// --- PLATFORM VARIANTS ---

export async function getPlatformVariants(db: D1Database, productId?: string, limit = DEFAULT_PAGE_SIZE, offset = 0): Promise<PlatformVariant[]> {
  if (productId) {
    const result = await db
      .prepare("SELECT id, product_id, platform_id, title, description, tags, price, metadata, status, published_at FROM platform_variants WHERE product_id = ? LIMIT ? OFFSET ?")
      .bind(productId, limit, offset)
      .all<PlatformVariant>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT id, product_id, platform_id, title, description, tags, price, metadata, status, published_at FROM platform_variants LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all<PlatformVariant>();
  return result.results;
}

export async function getPlatformVariantById(db: D1Database, id: string): Promise<PlatformVariant | null> {
  return db
    .prepare("SELECT * FROM platform_variants WHERE id = ?")
    .bind(id)
    .first<PlatformVariant>();
}

export async function createPlatformVariant(db: D1Database, variant: PlatformVariant): Promise<PlatformVariant> {
  await db
    .prepare(
      "INSERT INTO platform_variants (id, product_id, platform_id, title, description, tags, price, metadata, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      variant.id,
      variant.product_id,
      variant.platform_id,
      variant.title,
      variant.description,
      variant.tags ? JSON.stringify(variant.tags) : null,
      variant.price ?? null,
      variant.metadata ? JSON.stringify(variant.metadata) : null,
      variant.status,
      variant.published_at ?? null
    )
    .run();
  return variant;
}

export async function updatePlatformVariant(
  db: D1Database,
  id: string,
  data: Partial<Omit<PlatformVariant, "id">>
): Promise<void> {
  await executeUpdate(db, "platform_variants", id, data as Record<string, unknown>, [
    { column: "product_id" },
    { column: "platform_id" },
    { column: "title" },
    { column: "description" },
    { column: "tags", transform: (v) => JSON.stringify(v) },
    { column: "price" },
    { column: "metadata", transform: (v) => JSON.stringify(v) },
    { column: "status" },
    { column: "published_at" },
  ]);
}

export async function deletePlatformVariant(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("DELETE FROM platform_variants WHERE id = ?")
    .bind(id)
    .run();
}

// --- SOCIAL VARIANTS ---

export async function getSocialVariants(db: D1Database, productId?: string, limit = DEFAULT_PAGE_SIZE, offset = 0): Promise<SocialVariant[]> {
  if (productId) {
    const result = await db
      .prepare("SELECT id, product_id, channel_id, content, status, scheduled_at, published_at FROM social_variants WHERE product_id = ? LIMIT ? OFFSET ?")
      .bind(productId, limit, offset)
      .all<SocialVariant>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT id, product_id, channel_id, content, status, scheduled_at, published_at FROM social_variants LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all<SocialVariant>();
  return result.results;
}

export async function getSocialVariantById(db: D1Database, id: string): Promise<SocialVariant | null> {
  return db
    .prepare("SELECT * FROM social_variants WHERE id = ?")
    .bind(id)
    .first<SocialVariant>();
}

export async function createSocialVariant(db: D1Database, variant: SocialVariant): Promise<SocialVariant> {
  await db
    .prepare(
      "INSERT INTO social_variants (id, product_id, channel_id, content, status, scheduled_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      variant.id,
      variant.product_id,
      variant.channel_id,
      JSON.stringify(variant.content),
      variant.status,
      variant.scheduled_at ?? null,
      variant.published_at ?? null
    )
    .run();
  return variant;
}

export async function updateSocialVariant(
  db: D1Database,
  id: string,
  data: Partial<Omit<SocialVariant, "id">>
): Promise<void> {
  await executeUpdate(db, "social_variants", id, data as Record<string, unknown>, [
    { column: "product_id" },
    { column: "channel_id" },
    { column: "content", transform: (v) => JSON.stringify(v) },
    { column: "status" },
    { column: "scheduled_at" },
    { column: "published_at" },
  ]);
}

export async function deleteSocialVariant(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("DELETE FROM social_variants WHERE id = ?")
    .bind(id)
    .run();
}
