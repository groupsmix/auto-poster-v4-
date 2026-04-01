import { Hono } from "hono";
import type { ApiResponse, CompetitorPrice, PriceRule, CompetitorPriceSummary } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse } from "../helpers";

const competitorPricing = new Hono<{ Bindings: RouterEnv }>();

// GET /api/competitor-pricing — get price summaries grouped by niche
competitorPricing.get("/", async (c) => {
  try {
    const summaries = await storageQuery<CompetitorPriceSummary[]>(
      c.env,
      `SELECT
        niche,
        platform,
        ROUND(AVG(price), 2) as avg_price,
        ROUND(MIN(price), 2) as min_price,
        ROUND(MAX(price), 2) as max_price,
        COUNT(*) as count,
        0 as suggested_price
      FROM competitor_prices
      GROUP BY niche, platform
      ORDER BY count DESC`
    );

    // Apply price rules to compute suggested prices
    const rules = await storageQuery<PriceRule[]>(
      c.env,
      `SELECT * FROM price_rules WHERE is_active = 1`
    );

    const enriched = summaries.map((s) => {
      const rule = rules.find((r) => r.niche === s.niche && r.platform === s.platform);
      let suggested = s.avg_price;
      if (rule) {
        if (rule.strategy === "below_average") {
          suggested = s.avg_price * (1 + rule.adjustment_pct / 100);
        } else if (rule.strategy === "match_lowest") {
          suggested = s.min_price;
        }
        suggested = Math.max(rule.min_price, Math.min(rule.max_price, suggested));
      }
      return { ...s, suggested_price: Math.round(suggested * 100) / 100 };
    });

    return c.json<ApiResponse>({ success: true, data: enriched });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/competitor-pricing/prices — list all scraped prices
competitorPricing.get("/prices", async (c) => {
  try {
    const niche = c.req.query("niche");
    const limit = parseInt(c.req.query("limit") ?? "100");

    let sql = `SELECT * FROM competitor_prices`;
    const params: unknown[] = [];

    if (niche) {
      sql += ` WHERE niche = ?`;
      params.push(niche);
    }

    sql += ` ORDER BY scraped_at DESC LIMIT ?`;
    params.push(limit);

    const prices = await storageQuery<CompetitorPrice[]>(c.env, sql, params);
    return c.json<ApiResponse>({ success: true, data: prices });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/competitor-pricing/prices — add competitor price data
competitorPricing.post("/prices", async (c) => {
  try {
    const body = await c.req.json<{
      prices: Array<{
        niche: string;
        platform: string;
        competitor_name?: string;
        product_title: string;
        product_url?: string;
        price: number;
        currency?: string;
      }>;
    }>();

    if (!body.prices?.length) {
      return c.json<ApiResponse>({ success: false, error: "prices array is required" }, 400);
    }

    let inserted = 0;
    for (const p of body.prices) {
      const id = crypto.randomUUID();
      await storageQuery(
        c.env,
        `INSERT INTO competitor_prices (id, niche, platform, competitor_name, product_title, product_url, price, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, p.niche, p.platform, p.competitor_name ?? null, p.product_title, p.product_url ?? null, p.price, p.currency ?? "USD"]
      );
      inserted++;
    }

    return c.json<ApiResponse>({ success: true, data: { inserted } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/competitor-pricing/rules — list price rules
competitorPricing.get("/rules", async (c) => {
  try {
    const rules = await storageQuery<PriceRule[]>(
      c.env,
      `SELECT * FROM price_rules ORDER BY created_at DESC`
    );
    return c.json<ApiResponse>({ success: true, data: rules });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/competitor-pricing/rules — create a price rule
competitorPricing.post("/rules", async (c) => {
  try {
    const body = await c.req.json<{
      niche: string;
      platform: string;
      strategy?: string;
      adjustment_pct?: number;
      min_price?: number;
      max_price?: number;
    }>();

    if (!body.niche || !body.platform) {
      return c.json<ApiResponse>({ success: false, error: "niche and platform are required" }, 400);
    }

    const id = crypto.randomUUID();
    await storageQuery(
      c.env,
      `INSERT INTO price_rules (id, niche, platform, strategy, adjustment_pct, min_price, max_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.niche,
        body.platform,
        body.strategy ?? "below_average",
        body.adjustment_pct ?? -10,
        body.min_price ?? 0,
        body.max_price ?? 9999,
      ]
    );

    return c.json<ApiResponse>({ success: true, data: { id } }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/competitor-pricing/rules/:id — update a price rule
competitorPricing.put("/rules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<Partial<PriceRule>>();

    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.strategy !== undefined) { fields.push("strategy = ?"); params.push(body.strategy); }
    if (body.adjustment_pct !== undefined) { fields.push("adjustment_pct = ?"); params.push(body.adjustment_pct); }
    if (body.min_price !== undefined) { fields.push("min_price = ?"); params.push(body.min_price); }
    if (body.max_price !== undefined) { fields.push("max_price = ?"); params.push(body.max_price); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); params.push(body.is_active ? 1 : 0); }

    if (fields.length === 0) {
      return c.json<ApiResponse>({ success: false, error: "No fields to update" }, 400);
    }

    fields.push("updated_at = datetime('now')");
    params.push(id);

    await storageQuery(
      c.env,
      `UPDATE price_rules SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/competitor-pricing/rules/:id — delete a price rule
competitorPricing.delete("/rules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await storageQuery(c.env, `DELETE FROM price_rules WHERE id = ?`, [id]);
    return c.json<ApiResponse>({ success: true, data: { id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/competitor-pricing/scrape — scrape competitor prices from a platform
competitorPricing.post("/scrape", async (c) => {
  try {
    const body = await c.req.json<{
      niche: string;
      platform?: string;
      max_results?: number;
    }>();

    if (!body.niche) {
      return c.json<ApiResponse>({ success: false, error: "niche is required" }, 400);
    }

    const platform = body.platform ?? "etsy";
    const maxResults = body.max_results ?? 20;

    // Build search URL based on platform
    const searchUrl = buildSearchUrl(platform, body.niche);
    if (!searchUrl) {
      return c.json<ApiResponse>(
        { success: false, error: `Unsupported platform: ${platform}` },
        400
      );
    }

    // Fetch the search results page
    const resp = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!resp.ok) {
      return c.json<ApiResponse>(
        { success: false, error: `Failed to fetch ${platform}: HTTP ${resp.status}` },
        502
      );
    }

    const html = await resp.text();
    const prices = parseSearchResults(html, platform, body.niche, maxResults);

    // Store scraped prices
    let inserted = 0;
    for (const p of prices) {
      const id = crypto.randomUUID();
      await storageQuery(
        c.env,
        `INSERT INTO competitor_prices (id, niche, platform, competitor_name, product_title, product_url, price, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, p.niche, p.platform, p.competitor_name, p.product_title, p.product_url, p.price, p.currency]
      );
      inserted++;
    }

    return c.json<ApiResponse>({
      success: true,
      data: { scraped: prices.length, inserted, platform, niche: body.niche },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

function buildSearchUrl(platform: string, niche: string): string | null {
  const query = encodeURIComponent(niche);
  switch (platform) {
    case "etsy":
      return `https://www.etsy.com/search?q=${query}&ref=search_bar`;
    case "amazon":
      return `https://www.amazon.com/s?k=${query}`;
    default:
      return null;
  }
}

interface ScrapedPrice {
  niche: string;
  platform: string;
  competitor_name: string;
  product_title: string;
  product_url: string;
  price: number;
  currency: string;
}

function parseSearchResults(
  html: string,
  platform: string,
  niche: string,
  maxResults: number
): ScrapedPrice[] {
  const prices: ScrapedPrice[] = [];

  if (platform === "etsy") {
    // Parse Etsy search results — extract price and title from listing cards
    const listingPattern =
      /data-listing-id="[^"]*"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?currency_value">([\d,.]+)<\/span>/g;
    let match;
    while ((match = listingPattern.exec(html)) !== null && prices.length < maxResults) {
      const title = match[1].replace(/<[^>]+>/g, "").trim();
      const priceStr = match[2].replace(/,/g, "");
      const price = parseFloat(priceStr);
      if (title && !isNaN(price) && price > 0) {
        prices.push({
          niche,
          platform,
          competitor_name: "etsy_seller",
          product_title: title.slice(0, 200),
          product_url: "",
          price,
          currency: "USD",
        });
      }
    }

    // Fallback: try JSON-LD structured data
    if (prices.length === 0) {
      const jsonLdPattern = /"@type"\s*:\s*"Product"[\s\S]*?"name"\s*:\s*"([^"]+)"[\s\S]*?"price"\s*:\s*"?([\d.]+)"?/g;
      while ((match = jsonLdPattern.exec(html)) !== null && prices.length < maxResults) {
        const price = parseFloat(match[2]);
        if (!isNaN(price) && price > 0) {
          prices.push({
            niche,
            platform,
            competitor_name: "etsy_seller",
            product_title: match[1].slice(0, 200),
            product_url: "",
            price,
            currency: "USD",
          });
        }
      }
    }
  } else if (platform === "amazon") {
    // Parse Amazon search results
    const itemPattern =
      /data-asin="([A-Z0-9]+)"[\s\S]*?<span[^>]*class="a-text-normal"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="a-offscreen">\$([\d,.]+)<\/span>/g;
    let match;
    while ((match = itemPattern.exec(html)) !== null && prices.length < maxResults) {
      const asin = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const price = parseFloat(match[3].replace(/,/g, ""));
      if (title && !isNaN(price) && price > 0) {
        prices.push({
          niche,
          platform,
          competitor_name: "amazon_seller",
          product_title: title.slice(0, 200),
          product_url: `https://www.amazon.com/dp/${asin}`,
          price,
          currency: "USD",
        });
      }
    }
  }

  return prices;
}

export default competitorPricing;
