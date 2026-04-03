// ============================================================
// Attribution API — Revenue Tracking
// Track every dollar back to its source
// ============================================================

import { Hono } from "hono";
import type { CoreEnv } from "../index";

const app = new Hono<{ Bindings: CoreEnv; Variables: { requestId: string; nicheId?: string } }>();

// GET /api/attribution/report — Get attribution report
app.get("/report", async (c) => {
  const nicheId = c.get('nicheId')!;
  const days = parseInt(c.req.query('days') || '30');
  
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  // Get summary stats
  const summary = await c.env.DB.prepare(`
    SELECT 
      SUM(clicks) as total_clicks,
      SUM(conversions) as total_conversions,
      SUM(revenue_usd) as total_revenue,
      COUNT(DISTINCT product_id) as products_tracked
    FROM attribution
    WHERE niche_id = ? AND created_at > ?
  `).bind(nicheId, cutoff).first<{
    total_clicks: number;
    total_conversions: number;
    total_revenue: number;
    products_tracked: number;
  }>();
  
  // Get breakdown by platform
  const { results: byPlatform } = await c.env.DB.prepare(`
    SELECT 
      platform_id,
      SUM(clicks) as clicks,
      SUM(conversions) as conversions,
      SUM(revenue_usd) as revenue
    FROM attribution
    WHERE niche_id = ? AND created_at > ?
    GROUP BY platform_id
    ORDER BY revenue DESC
  `).bind(nicheId, cutoff).all();
  
  // Get top performing products
  const { results: topProducts } = await c.env.DB.prepare(`
    SELECT 
      p.name as product_name,
      a.product_id,
      SUM(a.clicks) as clicks,
      SUM(a.conversions) as conversions,
      SUM(a.revenue_usd) as revenue
    FROM attribution a
    JOIN products p ON p.id = a.product_id
    WHERE a.niche_id = ? AND a.created_at > ?
    GROUP BY a.product_id
    ORDER BY revenue DESC
    LIMIT 10
  `).bind(nicheId, cutoff).all();
  
  return c.json({
    success: true,
    data: {
      period_days: days,
      summary: {
        total_clicks: summary?.total_clicks || 0,
        total_conversions: summary?.total_conversions || 0,
        total_revenue: summary?.total_revenue || 0,
        products_tracked: summary?.products_tracked || 0,
        conversion_rate: summary?.total_clicks 
          ? ((summary.total_conversions / summary.total_clicks) * 100).toFixed(2) + '%'
          : '0%',
      },
      by_platform: byPlatform || [],
      top_products: topProducts || [],
    }
  });
});

// GET /api/attribution/track — Track a click (called from short URL)
app.get("/track/:shortCode", async (c) => {
  const shortCode = c.req.param('shortCode');
  
  // Get attribution record
  const attribution = await c.env.DB.prepare(`
    SELECT * FROM attribution WHERE short_code = ?
  `).bind(shortCode).first();
  
  if (!attribution) {
    return c.json({ success: false, error: 'Invalid tracking code' }, 404);
  }
  
  // Increment click counter
  await c.env.DB.prepare(`
    UPDATE attribution 
    SET clicks = clicks + 1, last_click_at = ?
    WHERE short_code = ?
  `).bind(new Date().toISOString(), shortCode).run();
  
  // Redirect to full URL
  return c.redirect(attribution.full_url as string);
});

// POST /api/attribution/webhook/stripe — Stripe webhook for conversions
app.post("/webhook/stripe", async (c) => {
  const body = await c.req.json();
  
  // Verify Stripe signature (in production)
  // const signature = c.req.header('Stripe-Signature');
  
  if (body.type === 'checkout.session.completed') {
    const session = body.data.object;
    
    // Find attribution by client_reference_id or metadata
    const utmContent = session.client_reference_id || session.metadata?.utm_content;
    
    if (utmContent) {
      // Update attribution with conversion
      await c.env.DB.prepare(`
        UPDATE attribution 
        SET conversions = conversions + 1, 
            stripe_payment_id = ?,
            revenue_usd = revenue_usd + ?
        WHERE product_id = ?
      `).bind(
        session.payment_intent,
        (session.amount_total || 0) / 100, // Convert from cents
        utmContent
      ).run();
      
      console.log(`[ATTRIBUTION] Conversion tracked: ${session.payment_intent}`);
    }
  }
  
  return c.json({ received: true });
});

// GET /api/attribution/product/:productId — Get attribution for specific product
app.get("/product/:productId", async (c) => {
  const productId = c.req.param('productId');
  const nicheId = c.get('nicheId')!;
  
  const { results } = await c.env.DB.prepare(`
    SELECT 
      platform_id,
      utm_source,
      utm_medium,
      clicks,
      conversions,
      revenue_usd,
      created_at
    FROM attribution
    WHERE niche_id = ? AND product_id = ?
    ORDER BY created_at DESC
  `).bind(nicheId, productId).all();
  
  return c.json({ success: true, data: results || [] });
});

export default app;
