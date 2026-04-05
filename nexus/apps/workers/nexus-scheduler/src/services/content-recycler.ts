// ============================================================
// Content Recycler Service
// Auto-resurface top 20% performers after 90 days
// "Passive income resurrection"
// ============================================================

import type { SchedulerEnv } from "../index";

export interface RecyclableContent {
  product_id: string;
  niche_id: string;
  name: string;
  original_created_at: string;
  performance_score: number;
  views: number;
  revenue: number;
  engagements: number;
}

export class ContentRecycler {
  private readonly RECYCLE_AGE_DAYS = 90;
  private readonly TOP_PERCENTILE = 0.2; // Top 20%
  
  constructor(private env: SchedulerEnv) {}

  // Main entry point - run recycling check
  async run(): Promise<void> {
    console.log('[RECYCLER] Starting content recycling check...');
    
    // Get all niches
    const { results: niches } = await this.env.DB.prepare(`
      SELECT id FROM niches WHERE is_active = true
    `).all<{ id: string }>();
    
    if (!niches || niches.length === 0) {
      console.log('[RECYCLER] No active niches found');
      return;
    }
    
    for (const niche of niches) {
      await this.recycleNiche(niche.id);
    }
    
    console.log('[RECYCLER] Content recycling check complete');
  }

  // Recycle content for a specific niche
  private async recycleNiche(nicheId: string): Promise<void> {
    // Find content that's 90+ days old
    const cutoff = new Date(Date.now() - this.RECYCLE_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    // Get performance metrics for old content
    const { results: oldContent } = await this.env.DB.prepare(`
      SELECT 
        p.id as product_id,
        p.niche_id,
        p.name,
        p.created_at as original_created_at,
        COALESCE(a.clicks, 0) as views,
        COALESCE(a.revenue_usd, 0) as revenue,
        COALESCE(a.conversions, 0) as engagements
      FROM products p
      LEFT JOIN attribution a ON a.product_id = p.id
      WHERE p.niche_id = ?
        AND p.created_at < ?
        AND p.status = 'published'
        AND NOT EXISTS (
          SELECT 1 FROM recycled_content r 
          WHERE r.original_product_id = p.id 
            AND r.scheduled_at > datetime('now', '-90 days')
        )
      GROUP BY p.id
    `).bind(nicheId, cutoff).all<RecyclableContent>();
    
    if (!oldContent || oldContent.length === 0) {
      return;
    }
    
    // Calculate performance scores
    const scoredContent = oldContent.map(content => ({
      ...content,
      performance_score: this.calculatePerformanceScore(content)
    }));
    
    // Sort by performance score
    scoredContent.sort((a, b) => b.performance_score - a.performance_score);
    
    // Take top 20%
    const topCount = Math.max(1, Math.floor(scoredContent.length * this.TOP_PERCENTILE));
    const topPerformers = scoredContent.slice(0, topCount);
    
    console.log(`[RECYCLER] Niche ${nicheId}: Found ${topPerformers.length} recyclable items from ${scoredContent.length} old products`);
    
    // Schedule recycling for each top performer
    for (const item of topPerformers) {
      await this.scheduleRecycling(item);
    }
  }

  // Calculate performance score based on views, revenue, and engagements
  private calculatePerformanceScore(content: RecyclableContent): number {
    // Weighted scoring
    const viewScore = content.views * 1;
    const revenueScore = content.revenue * 10; // Revenue weighted higher
    const engagementScore = content.engagements * 5;
    
    return viewScore + revenueScore + engagementScore;
  }

  // Schedule content for recycling
  private async scheduleRecycling(content: RecyclableContent): Promise<void> {
    // Generate wrapper text
    const wrapperText = this.generateWrapperText(content);
    const newAngle = this.generateNewAngle(content);
    
    // Create recycled_content record
    const recycledId = crypto.randomUUID();
    const scheduledAt = this.calculateOptimalResurfaceTime();
    
    await this.env.DB.prepare(`
      INSERT INTO recycled_content (
        id, niche_id, original_product_id, recycled_product_id,
        original_views, original_revenue, performance_score,
        wrapper_text, new_angle, scheduled_at, created_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      recycledId,
      content.niche_id,
      content.product_id,
      content.views,
      content.revenue,
      content.performance_score,
      wrapperText,
      newAngle,
      scheduledAt,
      new Date().toISOString()
    ).run();
    
    // Create a job to regenerate the product
    await this.env.NEXUS_CORE?.fetch("http://nexus-core/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Niche-ID": content.niche_id },
      body: JSON.stringify({
        job_type: 'recycle',
        entity_type: 'product',
        entity_id: content.product_id,
        input_json: {
          recycled_id: recycledId,
          wrapper_text: wrapperText,
          new_angle: newAngle,
          original_product_id: content.product_id,
        },
        scheduled_at: scheduledAt,
        priority: 3, // Lower priority than new content
      })
    });
    
    console.log(`[RECYCLER] Scheduled recycling for product ${content.product_id} at ${scheduledAt}`);
  }

  // Generate wrapper text for recycled content
  private generateWrapperText(content: RecyclableContent): string {
    const wrappers = [
      "Updated for 2026",
      "Still relevant: ",
      "Throwback to this gem:",
      "Revisiting a fan favorite:",
      "This performed amazingly — worth resharing:",
      "One of our best-performing products:",
    ];
    
    // Pick based on performance score
    if (content.performance_score > 1000) {
      return wrappers[4]; // "This performed amazingly"
    } else if (content.performance_score > 500) {
      return wrappers[5]; // "One of our best-performing"
    } else {
      return wrappers[Math.floor(Math.random() * 4)];
    }
  }

  // Generate a new angle for recycled content
  private generateNewAngle(content: RecyclableContent): string {
    const angles = [
      "focus_on_benefits",
      "customer_testimonial_style",
      "behind_the_scenes",
      "problem_solution",
      "comparison",
      "limited_time_offer",
    ];
    
    return angles[Math.floor(Math.random() * angles.length)];
  }

  // Calculate optimal time to resurface (peak engagement time)
  private calculateOptimalResurfaceTime(): string {
    // Schedule for next Tuesday at 10 AM (typically high engagement)
    const now = new Date();
    const daysUntilTuesday = (2 - now.getDay() + 7) % 7 || 7; // Next Tuesday
    
    const scheduled = new Date(now);
    scheduled.setDate(now.getDate() + daysUntilTuesday);
    scheduled.setHours(10, 0, 0, 0);
    
    return scheduled.toISOString();
  }

  // Get recycling stats
  async getStats(nicheId?: string): Promise<{
    total_recycled: number;
    scheduled: number;
    published: number;
    estimated_revenue_boost: number;
  }> {
    const conditions = nicheId ? 'WHERE niche_id = ?' : '';
    const values = nicheId ? [nicheId] : [];
    
    const stats = await this.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_recycled,
        SUM(CASE WHEN scheduled_at > datetime('now') THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN published_at IS NOT NULL THEN 1 ELSE 0 END) as published
      FROM recycled_content
      ${conditions}
    `).bind(...values).first<{
      total_recycled: number;
      scheduled: number;
      published: number;
    }>();
    
    // Estimate 30% revenue boost from recycled content
    const revenueBoost = (stats?.published || 0) * 30; // $30 average per recycled item
    
    return {
      total_recycled: stats?.total_recycled || 0,
      scheduled: stats?.scheduled || 0,
      published: stats?.published || 0,
      estimated_revenue_boost: revenueBoost,
    };
  }
}
