// ============================================================
// Synced Deletion — Removes data from ALL storage services in parallel
//
// When anything is deleted (product, asset, domain, category),
// ALL related data must be removed from ALL storage services:
//   1. DELETE from D1       -> removes all related rows (CASCADE)
//   2. DELETE from R2       -> removes all files/assets
//   3. DELETE from KV       -> removes cached config + AI cache
//   4. DELETE from CF Images -> removes image CDN entries
//   5. INVALIDATE AI Gateway cache -> removes cached responses
// All 5 run in PARALLEL (Promise.all) — fast
// ============================================================

import type { Asset } from "@nexus/shared";
import { D1Queries } from "./d1";
import { R2Storage } from "./r2";
import { KVCache } from "./kv";
import { CFImages } from "./images";

export interface CleanupResult {
  entity: string;
  id: string;
  d1Deleted: boolean;
  r2KeysDeleted: number;
  kvEntriesInvalidated: number;
  cfImagesDeleted: number;
  errors: string[];
}

export class CleanupService {
  constructor(
    private d1: D1Queries,
    private r2: R2Storage,
    private kv: KVCache,
    private images: CFImages
  ) {}

  /**
   * Delete a single product and ALL related data from ALL services in parallel.
   * D1 CASCADE handles related rows (workflow_runs, steps, assets, variants, etc.)
   * Then we clean up R2 files, CF Images, and KV cache entries.
   */
  async deleteProduct(productId: string): Promise<CleanupResult> {
    const errors: string[] = [];
    let r2KeysDeleted = 0;
    let cfImagesDeleted = 0;
    let kvEntriesInvalidated = 0;

    // First, gather asset info BEFORE deleting from D1 (need R2 keys + CF Image IDs)
    let assets: Asset[] = [];
    try {
      assets = await this.d1.getAssetsByProduct(productId);
    } catch (e) {
      errors.push(`Failed to fetch assets: ${e instanceof Error ? e.message : String(e)}`);
    }

    const r2Keys = assets.map((a) => a.r2_key).filter(Boolean);
    const cfImageIds = assets.map((a) => a.cf_image_id).filter((id): id is string => !!id);

    // Run all 5 deletions in PARALLEL
    const results = await Promise.allSettled([
      // 1. DELETE from D1 (CASCADE handles related rows)
      this.d1.deleteProduct(productId),

      // 2. DELETE from R2 (all files for this product)
      this.deleteR2Files(r2Keys),

      // 3. DELETE from KV (AI cache entries for this product)
      this.kv.invalidateAICache(productId),

      // 4. DELETE from CF Images (all images for this product)
      this.deleteCFImages(cfImageIds),

      // 5. INVALIDATE AI Gateway cache (placeholder — gateway cache is auto-managed)
      this.invalidateGatewayCache(productId),
    ]);

    // Process results
    if (results[0].status === "rejected") {
      errors.push(`D1 delete failed: ${results[0].reason}`);
    }

    if (results[1].status === "fulfilled") {
      r2KeysDeleted = results[1].value;
    } else {
      errors.push(`R2 delete failed: ${results[1].reason}`);
    }

    if (results[2].status === "fulfilled") {
      kvEntriesInvalidated = results[2].value;
    } else {
      errors.push(`KV invalidation failed: ${results[2].reason}`);
    }

    if (results[3].status === "fulfilled") {
      cfImagesDeleted = results[3].value;
    } else {
      errors.push(`CF Images delete failed: ${results[3].reason}`);
    }

    if (results[4].status === "rejected") {
      errors.push(`AI Gateway invalidation failed: ${results[4].reason}`);
    }

    return {
      entity: "product",
      id: productId,
      d1Deleted: results[0].status === "fulfilled",
      r2KeysDeleted,
      kvEntriesInvalidated,
      cfImagesDeleted,
      errors,
    };
  }

  /**
   * Delete a domain and ALL related data.
   * This cascades to all categories and products under this domain.
   */
  async deleteDomain(domainId: string): Promise<CleanupResult> {
    const errors: string[] = [];
    let r2KeysDeleted = 0;
    let cfImagesDeleted = 0;
    let kvEntriesInvalidated = 0;

    // Gather all product IDs under this domain BEFORE deleting
    let productIds: string[] = [];
    try {
      productIds = await this.d1.getProductIdsByDomain(domainId);
    } catch (e) {
      errors.push(`Failed to fetch product IDs: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Gather all assets for all products
    let allAssets: Asset[] = [];
    try {
      const assetPromises = productIds.map((pid) => this.d1.getAssetsByProduct(pid));
      const assetResults = await Promise.all(assetPromises);
      allAssets = assetResults.flat();
    } catch (e) {
      errors.push(`Failed to fetch assets: ${e instanceof Error ? e.message : String(e)}`);
    }

    const r2Keys = allAssets.map((a) => a.r2_key).filter(Boolean);
    const cfImageIds = allAssets.map((a) => a.cf_image_id).filter((id): id is string => !!id);

    // Run all deletions in PARALLEL
    const results = await Promise.allSettled([
      // 1. DELETE from D1 (CASCADE handles categories -> products -> assets, etc.)
      this.d1.deleteDomain(domainId),

      // 2. DELETE from R2
      this.deleteR2Files(r2Keys),

      // 3. DELETE from KV (invalidate AI cache for all products + domain config)
      Promise.all([
        ...productIds.map((pid) => this.kv.invalidateAICache(pid)),
        this.kv.deleteConfig(`domain:${domainId}`),
      ]),

      // 4. DELETE from CF Images
      this.deleteCFImages(cfImageIds),

      // 5. INVALIDATE AI Gateway cache
      Promise.all(productIds.map((pid) => this.invalidateGatewayCache(pid))),
    ]);

    if (results[0].status === "rejected") {
      errors.push(`D1 delete failed: ${results[0].reason}`);
    }

    if (results[1].status === "fulfilled") {
      r2KeysDeleted = results[1].value;
    } else {
      errors.push(`R2 delete failed: ${results[1].reason}`);
    }

    if (results[2].status === "fulfilled") {
      const kvResults = results[2].value;
      kvEntriesInvalidated = kvResults
        .filter((v): v is number => typeof v === "number")
        .reduce((sum, n) => sum + n, 0);
    } else {
      errors.push(`KV invalidation failed: ${results[2].reason}`);
    }

    if (results[3].status === "fulfilled") {
      cfImagesDeleted = results[3].value;
    } else {
      errors.push(`CF Images delete failed: ${results[3].reason}`);
    }

    if (results[4].status === "rejected") {
      errors.push(`AI Gateway invalidation failed: ${results[4].reason}`);
    }

    return {
      entity: "domain",
      id: domainId,
      d1Deleted: results[0].status === "fulfilled",
      r2KeysDeleted,
      kvEntriesInvalidated,
      cfImagesDeleted,
      errors,
    };
  }

  /**
   * Delete a category and ALL related data.
   * Same pattern as domain deletion.
   */
  async deleteCategory(categoryId: string): Promise<CleanupResult> {
    const errors: string[] = [];
    let r2KeysDeleted = 0;
    let cfImagesDeleted = 0;
    let kvEntriesInvalidated = 0;

    // Gather all product IDs under this category
    let productIds: string[] = [];
    try {
      productIds = await this.d1.getProductIdsByCategory(categoryId);
    } catch (e) {
      errors.push(`Failed to fetch product IDs: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Gather all assets
    let allAssets: Asset[] = [];
    try {
      const assetPromises = productIds.map((pid) => this.d1.getAssetsByProduct(pid));
      const assetResults = await Promise.all(assetPromises);
      allAssets = assetResults.flat();
    } catch (e) {
      errors.push(`Failed to fetch assets: ${e instanceof Error ? e.message : String(e)}`);
    }

    const r2Keys = allAssets.map((a) => a.r2_key).filter(Boolean);
    const cfImageIds = allAssets.map((a) => a.cf_image_id).filter((id): id is string => !!id);

    // Run all deletions in PARALLEL
    const results = await Promise.allSettled([
      this.d1.deleteCategory(categoryId),
      this.deleteR2Files(r2Keys),
      Promise.all([
        ...productIds.map((pid) => this.kv.invalidateAICache(pid)),
        this.kv.deleteConfig(`category:${categoryId}`),
      ]),
      this.deleteCFImages(cfImageIds),
      Promise.all(productIds.map((pid) => this.invalidateGatewayCache(pid))),
    ]);

    if (results[0].status === "rejected") {
      errors.push(`D1 delete failed: ${results[0].reason}`);
    }

    if (results[1].status === "fulfilled") {
      r2KeysDeleted = results[1].value;
    } else {
      errors.push(`R2 delete failed: ${results[1].reason}`);
    }

    if (results[2].status === "fulfilled") {
      const kvResults = results[2].value;
      kvEntriesInvalidated = kvResults
        .filter((v): v is number => typeof v === "number")
        .reduce((sum, n) => sum + n, 0);
    } else {
      errors.push(`KV invalidation failed: ${results[2].reason}`);
    }

    if (results[3].status === "fulfilled") {
      cfImagesDeleted = results[3].value;
    } else {
      errors.push(`CF Images delete failed: ${results[3].reason}`);
    }

    if (results[4].status === "rejected") {
      errors.push(`AI Gateway invalidation failed: ${results[4].reason}`);
    }

    return {
      entity: "category",
      id: categoryId,
      d1Deleted: results[0].status === "fulfilled",
      r2KeysDeleted,
      kvEntriesInvalidated,
      cfImagesDeleted,
      errors,
    };
  }

  /**
   * Delete a single asset from D1 + R2 + CF Images.
   */
  async deleteAsset(assetId: string): Promise<CleanupResult> {
    const errors: string[] = [];
    let r2KeysDeleted = 0;
    let cfImagesDeleted = 0;

    // Fetch asset info first
    let asset: Asset | null = null;
    try {
      asset = await this.d1.getAssetById(assetId);
    } catch (e) {
      errors.push(`Failed to fetch asset: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (!asset) {
      return {
        entity: "asset",
        id: assetId,
        d1Deleted: false,
        r2KeysDeleted: 0,
        kvEntriesInvalidated: 0,
        cfImagesDeleted: 0,
        errors: asset === null ? ["Asset not found"] : errors,
      };
    }

    // Run deletions in PARALLEL
    const deleteOps: Promise<unknown>[] = [
      this.d1.deleteAsset(assetId),
    ];

    if (asset.r2_key) {
      deleteOps.push(this.r2.deleteFile(asset.r2_key));
    }

    if (asset.cf_image_id) {
      deleteOps.push(this.images.deleteImage(asset.cf_image_id));
    }

    const results = await Promise.allSettled(deleteOps);

    if (results[0].status === "rejected") {
      errors.push(`D1 delete failed: ${results[0].reason}`);
    }

    if (asset.r2_key && results[1]) {
      if (results[1].status === "fulfilled") {
        r2KeysDeleted = 1;
      } else {
        errors.push(`R2 delete failed: ${results[1].reason}`);
      }
    }

    const cfIndex = asset.r2_key ? 2 : 1;
    if (asset.cf_image_id && results[cfIndex]) {
      if (results[cfIndex].status === "fulfilled") {
        cfImagesDeleted = 1;
      } else {
        errors.push(`CF Images delete failed: ${results[cfIndex].reason}`);
      }
    }

    return {
      entity: "asset",
      id: assetId,
      d1Deleted: results[0].status === "fulfilled",
      r2KeysDeleted,
      kvEntriesInvalidated: 0,
      cfImagesDeleted,
      errors,
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /** Delete multiple R2 files, returns count deleted */
  private async deleteR2Files(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    await this.r2.deleteFiles(keys);
    return keys.length;
  }

  /** Delete multiple CF Images, returns count deleted */
  private async deleteCFImages(imageIds: string[]): Promise<number> {
    if (imageIds.length === 0) return 0;
    const results = await Promise.allSettled(
      imageIds.map((id) => this.images.deleteImage(id))
    );
    return results.filter((r) => r.status === "fulfilled").length;
  }

  /**
   * Invalidate AI Gateway cache for a product.
   * AI Gateway cache invalidation is handled via the CF API.
   * Currently a no-op as gateway cache uses automatic TTL expiration.
   */
  private async invalidateGatewayCache(_productId: string): Promise<void> {
    // AI Gateway cache invalidation is managed by TTL settings on the gateway.
    // Manual purging can be added here when the AI Gateway purge API is available.
  }
}
