// ============================================================
// Competitor Price Alerts Service
// Price change detection, webhook notifications for price changes,
// Gumroad platform scraping support
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Gumroad scraping support ---

interface ScrapedPrice {
  niche: string;
  platform: string;
  competitor_name: string;
  product_title: string;
  product_url: string;
  price: number;
  currency: string;
}

/**
 * Build search URL for Gumroad.
 */
export function buildGumroadSearchUrl(niche: string): string {
  const query = encodeURIComponent(niche);
  return `https://gumroad.com/discover?query=${query}`;
}

/**
 * Parse Gumroad search results HTML to extract prices.
 */
export function parseGumroadResults(
  html: string,
  niche: string,
  maxResults: number
): ScrapedPrice[] {
  const prices: ScrapedPrice[] = [];

  // Gumroad product cards pattern — extract title and price
  const productPattern =
    /class="[^"]*product-card[^"]*"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?\$\s*([\d,.]+)/g;
  let match;
  while ((match = productPattern.exec(html)) !== null && prices.length < maxResults) {
    const title = match[1].replace(/<[^>]+>/g, "").trim();
    const priceStr = match[2].replace(/,/g, "");
    const price = parseFloat(priceStr);
    if (title && !isNaN(price) && price > 0) {
      prices.push({
        niche,
        platform: "gumroad",
        competitor_name: "gumroad_seller",
        product_title: title.slice(0, 200),
        product_url: "",
        price,
        currency: "USD",
      });
    }
  }

  // Fallback: try JSON data embedded in page
  if (prices.length === 0) {
    const jsonPattern = /"price_cents"\s*:\s*(\d+)[\s\S]*?"name"\s*:\s*"([^"]+)"/g;
    while ((match = jsonPattern.exec(html)) !== null && prices.length < maxResults) {
      const price = parseInt(match[1], 10) / 100;
      const title = match[2];
      if (title && price > 0) {
        prices.push({
          niche,
          platform: "gumroad",
          competitor_name: "gumroad_seller",
          product_title: title.slice(0, 200),
          product_url: "",
          price,
          currency: "USD",
        });
      }
    }

    // Also try reversed order
    const jsonPattern2 = /"name"\s*:\s*"([^"]+)"[\s\S]*?"price_cents"\s*:\s*(\d+)/g;
    while ((match = jsonPattern2.exec(html)) !== null && prices.length < maxResults) {
      const title = match[1];
      const price = parseInt(match[2], 10) / 100;
      if (title && price > 0) {
        prices.push({
          niche,
          platform: "gumroad",
          competitor_name: "gumroad_seller",
          product_title: title.slice(0, 200),
          product_url: "",
          price,
          currency: "USD",
        });
      }
    }
  }

  return prices;
}

// --- Price change detection ---

interface PriceChange {
  niche: string;
  platform: string;
  product_title: string;
  old_price: number;
  new_price: number;
  change_pct: number;
  direction: "up" | "down";
  detected_at: string;
}

/**
 * Detect price changes by comparing current scraped prices with historical data.
 * Fires webhook notifications for significant changes (>5% change).
 */
export async function detectPriceChanges(
  env: RouterEnv,
  changeThresholdPct: number = 5
): Promise<{
  checked: number;
  changes_detected: number;
  alerts_fired: number;
  changes: PriceChange[];
}> {
  // Get latest prices grouped by niche + platform + product_title
  const latestPrices = (await storageQuery<Array<{
    niche: string;
    platform: string;
    product_title: string;
    price: number;
    scraped_at: string;
  }>>(
    env,
    `SELECT cp1.niche, cp1.platform, cp1.product_title, cp1.price, cp1.scraped_at
     FROM competitor_prices cp1
     INNER JOIN (
       SELECT product_title, platform, MAX(scraped_at) as max_scraped
       FROM competitor_prices
       GROUP BY product_title, platform
     ) cp2 ON cp1.product_title = cp2.product_title
       AND cp1.platform = cp2.platform
       AND cp1.scraped_at = cp2.max_scraped
     ORDER BY cp1.scraped_at DESC
     LIMIT 200`
  )) ?? [];

  // Get previous prices (second most recent) for comparison
  const previousPrices = (await storageQuery<Array<{
    product_title: string;
    platform: string;
    price: number;
  }>>(
    env,
    `SELECT cp1.product_title, cp1.platform, cp1.price
     FROM competitor_prices cp1
     INNER JOIN (
       SELECT product_title, platform, MAX(scraped_at) as max_scraped
       FROM competitor_prices
       WHERE scraped_at < (
         SELECT MAX(scraped_at) FROM competitor_prices cp3
         WHERE cp3.product_title = competitor_prices.product_title
         AND cp3.platform = competitor_prices.platform
       )
       GROUP BY product_title, platform
     ) cp2 ON cp1.product_title = cp2.product_title
       AND cp1.platform = cp2.platform
       AND cp1.scraped_at = cp2.max_scraped`
  )) ?? [];

  const prevMap = new Map<string, number>();
  for (const p of previousPrices) {
    prevMap.set(`${p.platform}:${p.product_title}`, p.price);
  }

  const changes: PriceChange[] = [];

  for (const current of latestPrices) {
    const key = `${current.platform}:${current.product_title}`;
    const prevPrice = prevMap.get(key);
    if (prevPrice === undefined || prevPrice === current.price) continue;

    const changePct = ((current.price - prevPrice) / prevPrice) * 100;
    if (Math.abs(changePct) >= changeThresholdPct) {
      changes.push({
        niche: current.niche,
        platform: current.platform,
        product_title: current.product_title,
        old_price: prevPrice,
        new_price: current.price,
        change_pct: Math.round(changePct * 10) / 10,
        direction: changePct > 0 ? "up" : "down",
        detected_at: now(),
      });
    }
  }

  // Fire webhook notifications for price changes
  let alertsFired = 0;
  if (changes.length > 0) {
    try {
      const webhookPayload = {
        event: "competitor_price_change",
        changes: changes.slice(0, 10), // Cap at 10 per notification
        summary: `${changes.length} price change(s) detected across ${[...new Set(changes.map((c) => c.platform))].join(", ")}`,
      };

      // Fire webhook through the webhooks system
      const fireResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `SELECT id, url, platforms, events FROM webhook_configs WHERE is_active = 1`,
          params: [],
        }),
      });

      const fireJson = (await fireResp.json()) as {
        success: boolean;
        data?: { results?: Array<{ id: string; url: string; events: string }> };
      };

      if (fireJson.success && fireJson.data) {
        const webhooks = (fireJson.data as { results?: Array<{ id: string; url: string; events: string }> }).results ?? [];
        for (const wh of webhooks) {
          const events: string[] = typeof wh.events === "string" ? JSON.parse(wh.events) : [];
          if (!events.includes("competitor_price_change") && !events.includes("all")) continue;

          try {
            await fetch(wh.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(webhookPayload),
            });
            alertsFired++;
          } catch {
            // Webhook delivery is best-effort
          }
        }
      }
    } catch {
      // Alert firing is best-effort
    }
  }

  return {
    checked: latestPrices.length,
    changes_detected: changes.length,
    alerts_fired: alertsFired,
    changes,
  };
}
