// ============================================================
// Publish API — Platform Publishing with Fallback
// Includes: UTM auto-tagging, conflict detection, Playwright fallback
// ============================================================

import { Hono } from "hono";
import type { DispatchEnv } from "../index";
import { TwitterAdapter } from "../adapters/twitter";
import { LinkedInAdapter } from "../adapters/linkedin";
import { PlaywrightFallback } from "../adapters/playwright-fallback";
import { ConflictDetector } from "../services/conflict-detector";
import { UTMBuilder } from "../services/utm-builder";

const app = new Hono<{ Bindings: DispatchEnv; Variables: { requestId: string } }>();

// POST /publish — Publish content to platform
app.post("/", async (c) => {
  const requestId = c.get('requestId');
  const body = await c.req.json<{
    niche_id: string;
    product_id: string;
    platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'pinterest' | 'etsy' | 'gumroad';
    content: {
      text: string;
      media_urls?: string[];
      link?: string;
    };
    options?: {
      schedule_at?: string;
      skip_conflict_check?: boolean;
      force_playwright?: boolean;
      utm_params?: {
        medium?: string;
        campaign?: string;
        term?: string;
        content?: string;
      };
    };
  }>();
  
  console.log(`[${requestId}] Publish request: ${body.platform} for product ${body.product_id}`);
  
  try {
    // 1. CONFLICT DETECTION (unless skipped)
    if (!body.options?.skip_conflict_check) {
      const conflictDetector = new ConflictDetector(c.env.DB);
      const conflicts = await conflictDetector.checkConflicts(
        body.niche_id,
        body.content.text,
        body.platform
      );
      
      if (conflicts.length > 0) {
        console.log(`[${requestId}] Conflicts detected: ${conflicts.length}`);
        return c.json({
          success: false,
          error: 'Conflicting statements detected',
          conflicts: conflicts,
          action_required: 'Review conflicts or set skip_conflict_check: true',
        }, 409);
      }
    }
    
    // 2. UTM AUTO-TAGGING
    const utmBuilder = new UTMBuilder(c.env);
    const taggedContent = await utmBuilder.addUTMToContent(
      body.niche_id,
      body.product_id,
      body.platform,
      body.content,
      body.options?.utm_params
    );
    
    // 3. PUBLISH (API first, fallback to Playwright)
    let result: { success: boolean; platform_post_id?: string; url?: string; method: string };
    
    if (!body.options?.force_playwright) {
      // Try API first
      result = await publishViaAPI(c.env, body.platform, taggedContent);
      
      // If API fails, fallback to Playwright
      if (!result.success) {
        console.log(`[${requestId}] API publish failed, trying Playwright fallback`);
        result = await publishViaPlaywright(c.env, body.platform, taggedContent);
      }
    } else {
      // Force Playwright
      result = await publishViaPlaywright(c.env, body.platform, taggedContent);
    }
    
    // 4. STORE ATTRIBUTION
    if (result.success && result.url) {
      await storeAttribution(c.env, {
        niche_id: body.niche_id,
        product_id: body.product_id,
        platform: body.platform,
        url: result.url,
        utm_params: taggedContent.utm_params,
      });
    }
    
    // 5. STORE PUBLISHED STATEMENT (for conflict detection)
    if (result.success) {
      const conflictDetector = new ConflictDetector(c.env.DB);
      await conflictDetector.storeStatements(
        body.niche_id,
        body.product_id,
        body.content.text,
        body.platform
      );
    }
    
    return c.json({
      success: result.success,
      data: {
        platform: body.platform,
        platform_post_id: result.platform_post_id,
        url: result.url,
        method: result.method,
        utm_params: taggedContent.utm_params,
      }
    });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Publish failed: ${errorMsg}`);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

// POST /publish/batch — Batch publish
app.post("/batch", async (c) => {
  const body = await c.req.json<{
    niche_id: string;
    items: Array<{
      product_id: string;
      platform: string;
      content: { text: string; media_urls?: string[]; link?: string };
    }>;
    options?: { skip_conflict_check?: boolean };
  }>();
  
  const results = [];
  
  for (const item of body.items) {
    try {
      // Process each item
      const result = await fetch(`http://nexus-dispatch/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche_id: body.niche_id,
          ...item,
          options: body.options,
        })
      }).then(r => r.json());
      
      results.push({ product_id: item.product_id, ...result });
    } catch (error) {
      results.push({
        product_id: item.product_id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  
  return c.json({
    success: successCount === body.items.length,
    data: {
      total: body.items.length,
      successful: successCount,
      failed: body.items.length - successCount,
      results,
    }
  });
});

// GET /publish/status/:job_id — Check publish status
app.get("/status/:job_id", async (c) => {
  const jobId = c.req.param('job_id');
  
  // Query job status from D1
  const job = await c.env.DB.prepare(`
    SELECT id, status, current_step, error, output_json, updated_at
    FROM job_queue WHERE id = ?
  `).bind(jobId).first();
  
  if (!job) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }
  
  return c.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      current_step: job.current_step,
      error: job.error,
      output: job.output_json ? JSON.parse(job.output_json as string) : null,
      updated_at: job.updated_at,
    }
  });
});

// Helper: Publish via platform API
async function publishViaAPI(
  env: DispatchEnv,
  platform: string,
  content: { text: string; media_urls?: string[]; link?: string; utm_params?: Record<string, string> }
): Promise<{ success: boolean; platform_post_id?: string; url?: string; method: string; error?: string }> {
  try {
    switch (platform) {
      case 'twitter': {
        const twitter = new TwitterAdapter(env);
        return await twitter.publish(content);
      }
      case 'linkedin': {
        const linkedin = new LinkedInAdapter(env);
        return await linkedin.publish(content);
      }
      default:
        return { success: false, method: 'api', error: `Platform ${platform} not supported via API` };
    }
  } catch (error) {
    return { 
      success: false, 
      method: 'api', 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Helper: Publish via Playwright browser automation
async function publishViaPlaywright(
  env: DispatchEnv,
  platform: string,
  content: { text: string; media_urls?: string[]; link?: string }
): Promise<{ success: boolean; platform_post_id?: string; url?: string; method: string; error?: string }> {
  if (!env.PLAYWRIGHT_WS_ENDPOINT) {
    return { success: false, method: 'playwright', error: 'Playwright not configured' };
  }
  
  try {
    const playwright = new PlaywrightFallback(env);
    return await playwright.publish(platform, content);
  } catch (error) {
    return { 
      success: false, 
      method: 'playwright', 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Helper: Store attribution data
async function storeAttribution(
  env: DispatchEnv,
  data: {
    niche_id: string;
    product_id: string;
    platform: string;
    url: string;
    utm_params?: Record<string, string>;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const shortCode = generateShortCode();
  
  await env.DB.prepare(`
    INSERT INTO attribution (
      id, niche_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      short_code, full_url, product_id, platform_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.niche_id,
    data.utm_params?.utm_source || 'nexus',
    data.utm_params?.utm_medium || 'social',
    data.utm_params?.utm_campaign || data.niche_id,
    data.utm_params?.utm_content || data.product_id,
    data.utm_params?.utm_term || data.platform,
    shortCode,
    data.url,
    data.product_id,
    data.platform,
    new Date().toISOString()
  ).run();
}

// Generate short code for URL shortening
function generateShortCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'nx'; // nexus prefix
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default app;
