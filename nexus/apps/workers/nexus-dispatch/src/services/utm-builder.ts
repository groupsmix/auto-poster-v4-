// ============================================================
// UTM Builder Service
// Auto-generates UTM tags for revenue attribution
// ============================================================

import type { DispatchEnv } from "../index";

export interface UTMParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
}

export interface TaggedContent {
  text: string;
  link?: string;
  media_urls?: string[];
  utm_params: UTMParams;
  full_url?: string;
}

export class UTMBuilder {
  constructor(private env: DispatchEnv) {}

  // Add UTM parameters to content
  async addUTMToContent(
    nicheId: string,
    productId: string,
    platform: string,
    content: { text: string; link?: string; media_urls?: string[] },
    overrides?: Partial<UTMParams>
  ): Promise<TaggedContent> {
    // Build UTM parameters
    const utmParams: UTMParams = {
      utm_source: overrides?.utm_source || this.env.UTM_SOURCE || 'nexus',
      utm_medium: overrides?.utm_medium || this.env.UTM_MEDIUM || 'organic',
      utm_campaign: overrides?.utm_campaign || nicheId,
      utm_content: overrides?.utm_content || productId,
      utm_term: overrides?.utm_term || platform,
    };

    // Build full URL if link provided
    let fullUrl: string | undefined;
    if (content.link) {
      fullUrl = this.buildURL(content.link, utmParams);
    }

    // Replace links in text with UTM-tagged versions
    let taggedText = content.text;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    taggedText = taggedText.replace(urlRegex, (url) => {
      return this.buildURL(url, utmParams);
    });

    return {
      text: taggedText,
      link: content.link,
      media_urls: content.media_urls,
      utm_params: utmParams,
      full_url: fullUrl,
    };
  }

  // Build URL with UTM parameters
  private buildURL(baseUrl: string, params: UTMParams): string {
    try {
      const url = new URL(baseUrl);
      
      // Add UTM params
      url.searchParams.set('utm_source', params.utm_source);
      url.searchParams.set('utm_medium', params.utm_medium);
      url.searchParams.set('utm_campaign', params.utm_campaign);
      url.searchParams.set('utm_content', params.utm_content);
      url.searchParams.set('utm_term', params.utm_term);
      
      // Add Nexus tracking param
      url.searchParams.set('nx', this.generateTrackingCode(params));
      
      return url.toString();
    } catch {
      // If URL parsing fails, append params manually
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}utm_source=${encodeURIComponent(params.utm_source)}&utm_medium=${encodeURIComponent(params.utm_medium)}&utm_campaign=${encodeURIComponent(params.utm_campaign)}&utm_content=${encodeURIComponent(params.utm_content)}&utm_term=${encodeURIComponent(params.utm_term)}`;
    }
  }

  // Generate short tracking code
  private generateTrackingCode(params: UTMParams): string {
    const data = `${params.utm_campaign}:${params.utm_content}:${params.utm_term}`;
    // Simple hash for tracking
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).slice(0, 6);
  }

  // Parse UTM params from URL
  parseUTMFromURL(url: string): Partial<UTMParams> | null {
    try {
      const parsed = new URL(url);
      const params = parsed.searchParams;
      
      return {
        utm_source: params.get('utm_source') || undefined,
        utm_medium: params.get('utm_medium') || undefined,
        utm_campaign: params.get('utm_campaign') || undefined,
        utm_content: params.get('utm_content') || undefined,
        utm_term: params.get('utm_term') || undefined,
      };
    } catch {
      return null;
    }
  }

  // Track click (increment counter)
  async trackClick(shortCode: string): Promise<void> {
    await this.env.DB.prepare(`
      UPDATE attribution 
      SET clicks = clicks + 1, last_click_at = ?
      WHERE short_code = ?
    `).bind(new Date().toISOString(), shortCode).run();
  }

  // Track conversion (from Stripe webhook)
  async trackConversion(
    shortCode: string,
    stripePaymentId: string,
    revenueUsd: number
  ): Promise<void> {
    await this.env.DB.prepare(`
      UPDATE attribution 
      SET conversions = conversions + 1, stripe_payment_id = ?, revenue_usd = ?
      WHERE short_code = ?
    `).bind(stripePaymentId, revenueUsd, shortCode).run();
  }

  // Get attribution report
  async getAttributionReport(nicheId: string, days: number = 30): Promise<{
    total_clicks: number;
    total_conversions: number;
    total_revenue: number;
    by_platform: Record<string, { clicks: number; conversions: number; revenue: number }>;
  }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const { results } = await this.env.DB.prepare(`
      SELECT 
        platform_id,
        SUM(clicks) as clicks,
        SUM(conversions) as conversions,
        SUM(revenue_usd) as revenue
      FROM attribution
      WHERE niche_id = ? AND created_at > ?
      GROUP BY platform_id
    `).bind(nicheId, cutoff).all<{
      platform_id: string;
      clicks: number;
      conversions: number;
      revenue: number;
    }>();

    const totals = await this.env.DB.prepare(`
      SELECT 
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(revenue_usd) as total_revenue
      FROM attribution
      WHERE niche_id = ? AND created_at > ?
    `).bind(nicheId, cutoff).first<{
      total_clicks: number;
      total_conversions: number;
      total_revenue: number;
    }>();

    const byPlatform: Record<string, { clicks: number; conversions: number; revenue: number }> = {};
    for (const row of results || []) {
      byPlatform[row.platform_id] = {
        clicks: row.clicks || 0,
        conversions: row.conversions || 0,
        revenue: row.revenue || 0,
      };
    }

    return {
      total_clicks: totals?.total_clicks || 0,
      total_conversions: totals?.total_conversions || 0,
      total_revenue: totals?.total_revenue || 0,
      by_platform: byPlatform,
    };
  }
}
