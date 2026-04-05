// ============================================================
// Print-on-Demand (POD) Integrations Service
// Printful, Printify, Gelato API integration,
// mockup generation, POD dashboard
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Types ---

export interface PODProvider {
  name: string;
  slug: string;
  api_base: string;
  connected: boolean;
  api_key_env: string;
}

export interface PODProduct {
  id: string;
  provider: string;
  external_id?: string;
  title: string;
  description: string;
  product_type: string;
  variants: PODVariant[];
  mockup_urls: string[];
  status: "draft" | "synced" | "published" | "error";
  created_at: string;
  updated_at: string;
}

export interface PODVariant {
  id: string;
  size?: string;
  color?: string;
  price: number;
  sku?: string;
}

export interface MockupRequest {
  design_url: string;
  product_type: string;
  provider?: string;
  background_color?: string;
}

// --- Provider configurations ---

const POD_PROVIDERS: PODProvider[] = [
  {
    name: "Printful",
    slug: "printful",
    api_base: "https://api.printful.com",
    connected: false,
    api_key_env: "PRINTFUL_API_KEY",
  },
  {
    name: "Printify",
    slug: "printify",
    api_base: "https://api.printify.com/v1",
    connected: false,
    api_key_env: "PRINTIFY_API_KEY",
  },
  {
    name: "Gelato",
    slug: "gelato",
    api_base: "https://api.gelato.com/v3",
    connected: false,
    api_key_env: "GELATO_API_KEY",
  },
];

// --- Printful API ---

async function printfulRequest(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const resp = await fetch(`https://api.printful.com${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await resp.json()) as { result?: unknown; error?: { message?: string } };
    if (!resp.ok) {
      return { success: false, error: json.error?.message ?? `HTTP ${resp.status}` };
    }
    return { success: true, data: json.result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Printify API ---

async function printifyRequest(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const resp = await fetch(`https://api.printify.com/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    return { success: true, data: json };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Gelato API ---

async function gelatoRequest(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const resp = await fetch(`https://api.gelato.com/v3${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    return { success: true, data: json };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Main functions ---

/**
 * Get POD provider connection status.
 */
export function getProviderStatus(env: RouterEnv): PODProvider[] {
  return POD_PROVIDERS.map((p) => ({
    ...p,
    connected: !!(env[p.api_key_env] as string | undefined),
  }));
}

/**
 * Get product catalog from a POD provider.
 */
export async function getProviderCatalog(
  provider: string,
  env: RouterEnv
): Promise<{ success: boolean; products?: unknown[]; error?: string }> {
  switch (provider) {
    case "printful": {
      const key = env.PRINTFUL_API_KEY as string | undefined;
      if (!key) return { success: false, error: "PRINTFUL_API_KEY not configured" };
      const result = await printfulRequest(key, "GET", "/products");
      return { success: result.success, products: result.data as unknown[] | undefined, error: result.error };
    }
    case "printify": {
      const key = env.PRINTIFY_API_KEY as string | undefined;
      if (!key) return { success: false, error: "PRINTIFY_API_KEY not configured" };
      const result = await printifyRequest(key, "GET", "/catalog/blueprints.json");
      return { success: result.success, products: result.data as unknown[] | undefined, error: result.error };
    }
    case "gelato": {
      const key = env.GELATO_API_KEY as string | undefined;
      if (!key) return { success: false, error: "GELATO_API_KEY not configured" };
      const result = await gelatoRequest(key, "GET", "/products");
      return { success: result.success, products: result.data as unknown[] | undefined, error: result.error };
    }
    default:
      return { success: false, error: `Unknown provider: ${provider}` };
  }
}

/**
 * Create a product on a POD provider.
 */
export async function createPODProduct(
  provider: string,
  productData: {
    title: string;
    description: string;
    product_type: string;
    design_url: string;
    variants?: Array<{ size?: string; color?: string; price: number }>;
  },
  env: RouterEnv
): Promise<{ success: boolean; external_id?: string; error?: string }> {
  switch (provider) {
    case "printful": {
      const key = env.PRINTFUL_API_KEY as string | undefined;
      if (!key) return { success: false, error: "PRINTFUL_API_KEY not configured" };

      const result = await printfulRequest(key, "POST", "/store/products", {
        sync_product: {
          name: productData.title,
          thumbnail: productData.design_url,
        },
        sync_variants: (productData.variants ?? [{ price: 19.99 }]).map((v) => ({
          retail_price: v.price,
          variant_id: 1, // Placeholder — would need actual variant IDs from catalog
          files: [{ url: productData.design_url }],
        })),
      });

      if (result.success) {
        const data = result.data as { id?: number };
        return { success: true, external_id: String(data?.id ?? "") };
      }
      return { success: false, error: result.error };
    }

    case "printify": {
      const key = env.PRINTIFY_API_KEY as string | undefined;
      if (!key) return { success: false, error: "PRINTIFY_API_KEY not configured" };

      // First get shop ID
      const shopsResult = await printifyRequest(key, "GET", "/shops.json");
      if (!shopsResult.success) return { success: false, error: shopsResult.error };

      const shops = shopsResult.data as Array<{ id: number }>;
      if (!shops.length) return { success: false, error: "No Printify shops found" };

      const shopId = shops[0].id;
      const result = await printifyRequest(key, "POST", `/shops/${shopId}/products.json`, {
        title: productData.title,
        description: productData.description,
        blueprint_id: 6, // T-shirt default — would need catalog lookup
        print_provider_id: 1,
        variants: (productData.variants ?? [{ price: 19.99 }]).map((v, i) => ({
          id: i + 1,
          price: Math.round(v.price * 100),
          is_enabled: true,
        })),
        print_areas: [{
          variant_ids: [1],
          placeholders: [{
            position: "front",
            images: [{ id: "placeholder", x: 0, y: 0, scale: 1, angle: 0 }],
          }],
        }],
      });

      if (result.success) {
        const data = result.data as { id?: string };
        return { success: true, external_id: data?.id };
      }
      return { success: false, error: result.error };
    }

    case "gelato": {
      const key = env.GELATO_API_KEY as string | undefined;
      if (!key) return { success: false, error: "GELATO_API_KEY not configured" };

      const result = await gelatoRequest(key, "POST", "/orders", {
        orderType: "draft",
        items: [{
          itemReferenceId: generateId(),
          productUid: productData.product_type,
          quantity: 1,
          fileUrl: productData.design_url,
        }],
      });

      if (result.success) {
        const data = result.data as { id?: string };
        return { success: true, external_id: data?.id };
      }
      return { success: false, error: result.error };
    }

    default:
      return { success: false, error: `Unknown provider: ${provider}` };
  }
}

/**
 * Generate a mockup image using the design on a product template.
 * Uses Cloudflare Images or an external service for mockup generation.
 */
export async function generateMockup(
  request: MockupRequest,
  env: RouterEnv
): Promise<{ success: boolean; mockup_url?: string; error?: string }> {
  const provider = request.provider ?? "printful";

  if (provider === "printful") {
    const key = env.PRINTFUL_API_KEY as string | undefined;
    if (!key) return { success: false, error: "PRINTFUL_API_KEY not configured" };

    const result = await printfulRequest(key, "POST", "/mockup-generator/create-task/71", {
      variant_ids: [4012], // Default t-shirt variant
      files: [{ placement: "front", image_url: request.design_url }],
    });

    if (result.success) {
      const data = result.data as { task_key?: string };
      // Poll for mockup result
      if (data?.task_key) {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const statusResult = await printfulRequest(key, "GET", `/mockup-generator/task?task_key=${data.task_key}`);
          if (statusResult.success) {
            const statusData = statusResult.data as { status?: string; mockups?: Array<{ mockup_url?: string }> };
            if (statusData?.status === "completed" && statusData.mockups?.[0]?.mockup_url) {
              return { success: true, mockup_url: statusData.mockups[0].mockup_url };
            }
          }
        }
        return { success: false, error: "Mockup generation timed out" };
      }
    }
    return { success: false, error: result.error };
  }

  // Fallback: use Placeit API if available
  const placeitKey = env.PLACEIT_API_KEY as string | undefined;
  if (placeitKey) {
    try {
      const resp = await fetch("https://placeit.net/api/v1/mockups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${placeitKey}`,
        },
        body: JSON.stringify({
          design_url: request.design_url,
          template: request.product_type,
        }),
      });

      if (resp.ok) {
        const data = (await resp.json()) as { url?: string };
        return { success: true, mockup_url: data.url };
      }
    } catch {
      // Fall through
    }
  }

  return { success: false, error: "No mockup provider available" };
}

/**
 * Get POD dashboard data.
 */
export async function getPODDashboard(env: RouterEnv): Promise<{
  providers: PODProvider[];
  recent_products: Array<{
    id: string;
    provider: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  stats: {
    total_products: number;
    synced: number;
    draft: number;
    error: number;
  };
}> {
  const providers = getProviderStatus(env);

  const products = (await storageQuery<Array<{
    id: string;
    provider: string;
    title: string;
    status: string;
    created_at: string;
  }>>(
    env,
    `SELECT id, provider, title, status, created_at FROM pod_products ORDER BY created_at DESC LIMIT 20`
  )) ?? [];

  const stats = (await storageQuery<Array<{
    total_products: number;
    synced: number;
    draft: number;
    error: number;
  }>>(
    env,
    `SELECT
      COUNT(*) as total_products,
      SUM(CASE WHEN status = 'synced' THEN 1 ELSE 0 END) as synced,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error
    FROM pod_products`
  )) ?? [];

  return {
    providers,
    recent_products: products,
    stats: stats[0] ?? { total_products: 0, synced: 0, draft: 0, error: 0 },
  };
}
