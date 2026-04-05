// ============================================================
// POD (Print-on-Demand) Dashboard & Integration Routes
// GET /api/pod/dashboard
// GET /api/pod/providers
// GET /api/pod/catalog/:provider
// POST /api/pod/products
// POST /api/pod/mockup
// ============================================================

import { Hono } from "hono";
import { generateId, now } from "@nexus/shared";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";
import {
  getProviderStatus,
  getProviderCatalog,
  createPODProduct,
  generateMockup,
  getPODDashboard,
} from "../services/pod-service";

const pod = new Hono<{ Bindings: RouterEnv }>();

// GET /api/pod/dashboard — get POD dashboard data
pod.get("/dashboard", async (c) => {
  try {
    const data = await getPODDashboard(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/pod/providers — get provider connection status
pod.get("/providers", async (c) => {
  try {
    const providers = getProviderStatus(c.env);
    return c.json<ApiResponse>({ success: true, data: providers });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/pod/catalog/:provider — get product catalog from a provider
pod.get("/catalog/:provider", async (c) => {
  try {
    const provider = c.req.param("provider");
    const result = await getProviderCatalog(provider, c.env);
    if (!result.success) {
      return c.json<ApiResponse>({ success: false, error: result.error }, 400);
    }
    return c.json<ApiResponse>({ success: true, data: result.products });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/pod/products — create a product on a POD provider
pod.post("/products", async (c) => {
  try {
    const body = await c.req.json<{
      provider: string;
      title: string;
      description: string;
      product_type: string;
      design_url: string;
      variants?: Array<{ size?: string; color?: string; price: number }>;
    }>();

    if (!body.provider || !body.title || !body.design_url) {
      return c.json<ApiResponse>({ success: false, error: "provider, title, and design_url are required" }, 400);
    }

    // Create on provider
    const result = await createPODProduct(body.provider, body, c.env);

    // Store in local database
    const id = generateId();
    await storageQuery(
      c.env,
      `INSERT INTO pod_products (id, provider, external_id, title, description, product_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.provider,
        result.external_id ?? null,
        body.title,
        body.description ?? "",
        body.product_type ?? "general",
        result.success ? "synced" : "error",
        now(),
        now(),
      ]
    );

    return c.json<ApiResponse>({
      success: result.success,
      data: { id, external_id: result.external_id },
      error: result.error,
    }, result.success ? 201 : 400);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/pod/mockup — generate a product mockup
pod.post("/mockup", async (c) => {
  try {
    const body = await c.req.json<{
      design_url: string;
      product_type: string;
      provider?: string;
      background_color?: string;
    }>();

    if (!body.design_url || !body.product_type) {
      return c.json<ApiResponse>({ success: false, error: "design_url and product_type are required" }, 400);
    }

    const result = await generateMockup(body, c.env);
    return c.json<ApiResponse>({
      success: result.success,
      data: result.mockup_url ? { mockup_url: result.mockup_url } : undefined,
      error: result.error,
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default pod;
