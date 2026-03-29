// ============================================================
// nexus-variation Worker — Hono.js Entry Point
// Platform variation, social media adaptation, and humanizer
// ============================================================

import { Hono } from "hono";
import type { Env } from "@nexus/shared";
import {
  PlatformVariationEngine,
  type BaseProduct,
} from "./platform";
import { SocialAdaptationEngine } from "./social";
import { Humanizer } from "./humanizer";

const app = new Hono<{ Bindings: Env }>();

// --- Health / Info ---

app.get("/", (c) => {
  return c.json({
    service: "nexus-variation",
    status: "ok",
    version: "0.1.0",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// ============================================================
// POST /variation/platform
// Generate a single platform variant
// Body: { baseProduct: BaseProduct, platformId: string }
// ============================================================

app.post("/variation/platform", async (c) => {
  try {
    const body = await c.req.json<{
      baseProduct: BaseProduct;
      platformId: string;
    }>();

    if (!body.baseProduct || !body.platformId) {
      return c.json(
        { success: false, error: "Missing baseProduct or platformId" },
        400
      );
    }

    const engine = new PlatformVariationEngine(c.env);
    const result = await engine.generatePlatformVariant(
      body.baseProduct,
      body.platformId
    );

    return c.json({
      success: true,
      data: {
        variant: result.variant,
        model: result.model,
        cached: result.cached,
        validation: result.validation,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[VARIATION] Platform variant error:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ============================================================
// POST /variation/platforms
// Generate variants for multiple platforms
// Body: { baseProduct: BaseProduct, platformIds: string[] }
// ============================================================

app.post("/variation/platforms", async (c) => {
  try {
    const body = await c.req.json<{
      baseProduct: BaseProduct;
      platformIds: string[];
    }>();

    if (!body.baseProduct || !body.platformIds || body.platformIds.length === 0) {
      return c.json(
        { success: false, error: "Missing baseProduct or platformIds" },
        400
      );
    }

    const engine = new PlatformVariationEngine(c.env);
    const result = await engine.generateAllPlatformVariants(
      body.baseProduct,
      body.platformIds
    );

    return c.json({
      success: true,
      data: {
        variants: result.variants,
        errors: result.errors,
        total: body.platformIds.length,
        succeeded: result.variants.length,
        failed: result.errors.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[VARIATION] Multi-platform error:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ============================================================
// POST /variation/social
// Generate social content for a single channel
// Body: { baseProduct: BaseProduct, channelId: string }
// ============================================================

app.post("/variation/social", async (c) => {
  try {
    const body = await c.req.json<{
      baseProduct: BaseProduct;
      channelId: string;
    }>();

    if (!body.baseProduct || !body.channelId) {
      return c.json(
        { success: false, error: "Missing baseProduct or channelId" },
        400
      );
    }

    const engine = new SocialAdaptationEngine(c.env);
    const result = await engine.generateSocialContent(
      body.baseProduct,
      body.channelId
    );

    return c.json({
      success: true,
      data: {
        content: result.content,
        model: result.model,
        cached: result.cached,
        validation: result.validation,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[VARIATION] Social content error:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ============================================================
// POST /variation/socials
// Generate social content for multiple channels
// Body: { baseProduct: BaseProduct, channelIds: string[] }
// ============================================================

app.post("/variation/socials", async (c) => {
  try {
    const body = await c.req.json<{
      baseProduct: BaseProduct;
      channelIds: string[];
    }>();

    if (!body.baseProduct || !body.channelIds || body.channelIds.length === 0) {
      return c.json(
        { success: false, error: "Missing baseProduct or channelIds" },
        400
      );
    }

    const engine = new SocialAdaptationEngine(c.env);
    const result = await engine.generateAllSocialContent(
      body.baseProduct,
      body.channelIds
    );

    return c.json({
      success: true,
      data: {
        contents: result.contents,
        errors: result.errors,
        total: body.channelIds.length,
        succeeded: result.contents.length,
        failed: result.errors.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[VARIATION] Multi-social error:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ============================================================
// POST /variation/humanize
// Humanize a single piece of text content
// Body: { content: string }
// ============================================================

app.post("/variation/humanize", async (c) => {
  try {
    const body = await c.req.json<{ content: string }>();

    if (!body.content) {
      return c.json(
        { success: false, error: "Missing content" },
        400
      );
    }

    const humanizer = new Humanizer(c.env);
    const result = await humanizer.humanizeContent(body.content);

    return c.json({
      success: true,
      data: {
        original: result.original,
        humanized: result.humanized,
        human_score: result.human_score,
        model: result.model,
        cached: result.cached,
        patterns_found: result.patterns_found,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[VARIATION] Humanize error:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

// ============================================================
// POST /variation/humanize-product
// Humanize all text fields of a product
// Body: { product: { name, title?, description?,
//         platform_variants?, social_content? } }
// ============================================================

app.post("/variation/humanize-product", async (c) => {
  try {
    const body = await c.req.json<{
      product: {
        name: string;
        title?: string;
        description?: string;
        platform_variants?: Record<string, { title: string; description: string }>;
        social_content?: Record<string, { caption?: string; post?: string; tweet?: string; hook?: string; title?: string; description?: string }>;
      };
    }>();

    if (!body.product || !body.product.name) {
      return c.json(
        { success: false, error: "Missing product or product.name" },
        400
      );
    }

    const humanizer = new Humanizer(c.env);
    const result = await humanizer.humanizeProduct(body.product);

    return c.json({
      success: true,
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[VARIATION] Humanize-product error:", message);
    return c.json({ success: false, error: message }, 500);
  }
});

export default app;
