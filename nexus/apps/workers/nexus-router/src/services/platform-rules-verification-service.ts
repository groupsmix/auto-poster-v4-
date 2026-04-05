// ============================================================
// Platform Rules Sync Verification Service
// Verifies that KV-stored platform rules are actually loaded
// and used by the variation engine (not falling back to defaults)
// ============================================================

import type { RouterEnv } from "../helpers";
import { forwardToService } from "../helpers";

interface VerificationResult {
  platform: string;
  kv_rules_found: boolean;
  kv_rules: Record<string, unknown> | null;
  variation_engine_used_kv: boolean;
  default_rules: Record<string, unknown> | null;
  differences: string[];
  status: "synced" | "fallback" | "missing" | "error";
}

const KNOWN_PLATFORMS = [
  "etsy", "gumroad", "shopify", "redbubble", "amazon_kdp",
  "payhip", "tiktok_shop", "pinterest", "instagram", "twitter",
];

/**
 * Verify that platform rules in KV are correctly loaded by the variation engine.
 * For each platform:
 * 1. Check if KV has custom rules
 * 2. Call variation engine to check what rules it loads
 * 3. Compare and report differences
 */
export async function verifyPlatformRulesSync(
  env: RouterEnv,
  platformSlugs?: string[]
): Promise<{
  verified: number;
  synced: number;
  fallback: number;
  missing: number;
  errors: number;
  results: VerificationResult[];
}> {
  const platforms = platformSlugs ?? KNOWN_PLATFORMS;
  const results: VerificationResult[] = [];

  for (const slug of platforms) {
    try {
      // Step 1: Check KV for custom rules
      let kvRules: Record<string, unknown> | null = null;
      let kvFound = false;

      try {
        const kvResp = await env.NEXUS_STORAGE.fetch(
          `http://nexus-storage/kv/platform:${slug}`
        );
        const kvJson = (await kvResp.json()) as {
          success: boolean;
          data?: { value?: string } | null;
        };

        if (kvJson.success && kvJson.data) {
          const value = (kvJson.data as { value?: string }).value;
          if (value) {
            kvRules = JSON.parse(value);
            kvFound = true;
          }
        }
      } catch {
        // KV lookup failed — this is expected if no custom rules exist
      }

      // Step 2: Call variation engine to verify what rules it loads
      let variationUsedKV = false;
      let engineRules: Record<string, unknown> | null = null;

      try {
        const verifyResp = await env.NEXUS_VARIATION.fetch(
          `http://nexus-variation/variation/rules/${slug}`
        );
        const verifyJson = (await verifyResp.json()) as {
          success: boolean;
          data?: { rules?: Record<string, unknown>; source?: string };
        };

        if (verifyJson.success && verifyJson.data) {
          engineRules = verifyJson.data.rules ?? null;
          variationUsedKV = verifyJson.data.source === "kv";
        }
      } catch {
        // Variation engine may not have this endpoint yet — that's ok
      }

      // Step 3: Compare
      const differences: string[] = [];
      if (kvFound && kvRules && engineRules) {
        for (const key of Object.keys(kvRules)) {
          const kvVal = JSON.stringify(kvRules[key]);
          const engineVal = JSON.stringify((engineRules as Record<string, unknown>)[key]);
          if (kvVal !== engineVal) {
            differences.push(`${key}: KV="${kvVal}" vs Engine="${engineVal}"`);
          }
        }
      }

      let status: VerificationResult["status"] = "synced";
      if (!kvFound) {
        status = "missing";
      } else if (!variationUsedKV) {
        status = "fallback";
      } else if (differences.length > 0) {
        status = "fallback";
      }

      results.push({
        platform: slug,
        kv_rules_found: kvFound,
        kv_rules: kvRules,
        variation_engine_used_kv: variationUsedKV,
        default_rules: engineRules,
        differences,
        status,
      });
    } catch (err) {
      results.push({
        platform: slug,
        kv_rules_found: false,
        kv_rules: null,
        variation_engine_used_kv: false,
        default_rules: null,
        differences: [],
        status: "error",
      });
    }
  }

  return {
    verified: results.length,
    synced: results.filter((r) => r.status === "synced").length,
    fallback: results.filter((r) => r.status === "fallback").length,
    missing: results.filter((r) => r.status === "missing").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}

/**
 * Force-sync platform rules from KV to the variation engine.
 * Reads from KV and writes back to ensure the engine picks them up.
 */
export async function forceSyncPlatformRules(
  slug: string,
  env: RouterEnv
): Promise<{ success: boolean; message: string }> {
  try {
    // Read current KV rules
    const kvResp = await env.NEXUS_STORAGE.fetch(
      `http://nexus-storage/kv/platform:${slug}`
    );
    const kvJson = (await kvResp.json()) as {
      success: boolean;
      data?: { value?: string } | null;
    };

    if (!kvJson.success || !kvJson.data) {
      return { success: false, message: `No KV rules found for platform: ${slug}` };
    }

    const value = (kvJson.data as { value?: string }).value;
    if (!value) {
      return { success: false, message: `KV rules are empty for platform: ${slug}` };
    }

    // Re-write the rules to KV to refresh the cache
    const writeResp = await env.NEXUS_STORAGE.fetch(
      `http://nexus-storage/kv/platform:${slug}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: `platform:${slug}`,
          value,
          metadata: { synced_at: new Date().toISOString() },
        }),
      }
    );

    const writeJson = (await writeResp.json()) as { success: boolean };
    if (!writeJson.success) {
      return { success: false, message: `Failed to write KV rules for ${slug}` };
    }

    return { success: true, message: `Platform rules re-synced for ${slug}` };
  } catch (err) {
    return {
      success: false,
      message: `Sync failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
