// ============================================================
// nexus-scheduler Worker — Cron Jobs, Recycling, Telegram Bot
// Replaces: nexus-workflow + scheduling logic
//
// Responsibilities:
// - Cron-triggered job processing
// - Content recycling (resurface top performers)
// - Telegram inbox capture bot
// - Optimal time scheduling
// - Git mirror exports
// ============================================================

import { Hono } from "hono";

// Services
import { ContentRecycler } from "./services/content-recycler";
import { TelegramBot } from "./services/telegram-bot";
import { GitMirror } from "./services/git-mirror";
import { OptimalTimeScheduler } from "./services/optimal-time";

// Routes
import health from "./routes/health";
import internal from "./routes/internal";

export interface SchedulerEnv {
  // D1 Database
  DB: D1Database;
  
  // KV for caching
  NEXUS_KV: KVNamespace;
  
  // R2 for exports
  NEXUS_R2: R2Bucket;
  
  // Telegram Bot Token
  TELEGRAM_BOT_TOKEN?: string;
  
  // Git Mirror Config
  GIT_MIRROR_REPO?: string;
  GIT_MIRROR_TOKEN?: string;
  
  // Service bindings
  NEXUS_CORE?: Fetcher;
  NEXUS_DISPATCH?: Fetcher;
}

const app = new Hono<{ Bindings: SchedulerEnv; Variables: { requestId: string } }>();

// Request ID middleware
app.use("*", async (c, next) => {
  const requestId = c.req.header("X-Request-ID") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});

// Routes
app.route("/health", health);
app.route("/internal", internal);

// Telegram webhook endpoint
app.post("/telegram/webhook", async (c) => {
  const update = await c.req.json();
  const bot = new TelegramBot(c.env);
  await bot.handleUpdate(update);
  return c.json({ ok: true });
});

// Root
app.get("/", (c) => c.json({ 
  service: "nexus-scheduler", 
  status: "ok", 
  version: "5.0.0",
  features: ['cron_jobs', 'content_recycling', 'telegram_bot', 'git_mirror', 'optimal_scheduling']
}));

// ============================================================
// SCHEDULED TRIGGERS (Cron Jobs)
// ============================================================

export default {
  async fetch(request: Request, env: SchedulerEnv, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  
  async scheduled(event: ScheduledEvent, env: SchedulerEnv, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    console.log(`[SCHEDULER] Running cron: ${cron}`);
    
    switch (cron) {
      // Every minute: Process job queue (high frequency)
      case '* * * * *':
        ctx.waitUntil(processJobQueue(env));
        break;
        
      // Every 5 minutes: Check for jobs to run
      case '*/5 * * * *':
        ctx.waitUntil(checkScheduledJobs(env));
        break;
        
      // Hourly: Content recycling check
      case '0 * * * *':
        ctx.waitUntil(runContentRecycling(env));
        break;
        
      // Daily at midnight: Git mirror export
      case '0 0 * * *':
        ctx.waitUntil(runGitMirror(env));
        break;
        
      // Daily at 6 AM: Daily briefing
      case '0 6 * * *':
        ctx.waitUntil(sendDailyBriefing(env));
        break;
        
      // Weekly: Cleanup expired data
      case '0 0 * * 0':
        ctx.waitUntil(cleanupExpiredData(env));
        break;
    }
  }
};

// Process job queue (claim and execute pending jobs)
async function processJobQueue(env: SchedulerEnv): Promise<void> {
  // Call nexus-core to claim and process jobs
  if (!env.NEXUS_CORE) return;
  
  try {
    await env.NEXUS_CORE.fetch("http://nexus-core/internal/process-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: 'scheduler', limit: 5 })
    });
  } catch (error) {
    console.error('[SCHEDULER] Job queue processing failed:', error);
  }
}

// Check for scheduled jobs that need to run
async function checkScheduledJobs(env: SchedulerEnv): Promise<void> {
  const now = new Date().toISOString();
  
  // Find jobs that are scheduled to run now
  const { results } = await env.DB.prepare(`
    SELECT * FROM job_queue 
    WHERE status = 'pending' 
      AND scheduled_at <= ?
      AND (lock_expires_at IS NULL OR lock_expires_at < ?)
    ORDER BY priority ASC, created_at ASC
    LIMIT 10
  `).bind(now, now).all();
  
  if (!results || results.length === 0) return;
  
  console.log(`[SCHEDULER] Found ${results.length} scheduled jobs to run`);
  
  // Trigger processing for each job
  for (const job of results) {
    try {
      await env.NEXUS_CORE?.fetch("http://nexus-core/internal/execute-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.id })
      });
    } catch (error) {
      console.error(`[SCHEDULER] Failed to execute job ${job.id}:`, error);
    }
  }
}

// Run content recycling (resurface top performers)
async function runContentRecycling(env: SchedulerEnv): Promise<void> {
  const recycler = new ContentRecycler(env);
  await recycler.run();
}

// Run Git mirror export
async function runGitMirror(env: SchedulerEnv): Promise<void> {
  if (!env.GIT_MIRROR_REPO || !env.GIT_MIRROR_TOKEN) {
    console.log('[SCHEDULER] Git mirror not configured, skipping');
    return;
  }
  
  const mirror = new GitMirror(env);
  await mirror.exportAllContent();
}

// Send daily briefing
async function sendDailyBriefing(env: SchedulerEnv): Promise<void> {
  // Get stats for last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as products_created,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as jobs_completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as jobs_failed
    FROM job_queue
    WHERE created_at > ?
  `).bind(cutoff).first<{
    products_created: number;
    jobs_completed: number;
    jobs_failed: number;
  }>();
  
  const revenue = await env.DB.prepare(`
    SELECT SUM(revenue_usd) as total_revenue
    FROM attribution
    WHERE created_at > ?
  `).bind(cutoff).first<{ total_revenue: number }>();
  
  const message = `
📊 NEXUS Daily Briefing

Last 24 Hours:
• Products Created: ${stats?.products_created || 0}
• Jobs Completed: ${stats?.jobs_completed || 0}
• Jobs Failed: ${stats?.jobs_failed || 0}
• Revenue: $${(revenue?.total_revenue || 0).toFixed(2)}

System Status: ✅ Healthy
  `.trim();
  
  // Send via Telegram if configured
  if (env.TELEGRAM_BOT_TOKEN) {
    const bot = new TelegramBot(env);
    // Send to admin chat (you'd store this in KV)
    const adminChatId = await env.NEXUS_KV.get('telegram:admin_chat_id');
    if (adminChatId) {
      await bot.sendMessage(adminChatId, message);
    }
  }
  
  console.log('[SCHEDULER] Daily briefing sent');
}

// Cleanup expired data
async function cleanupExpiredData(env: SchedulerEnv): Promise<void> {
  // Clean up expired content statements
  const statementsResult = await env.DB.prepare(`
    DELETE FROM content_statements WHERE expires_at < datetime('now')
  `).run();
  
  // Clean up old completed jobs (keep 90 days)
  const jobsResult = await env.DB.prepare(`
    DELETE FROM job_queue 
    WHERE status IN ('completed', 'cancelled', 'failed')
      AND completed_at < datetime('now', '-90 days')
  `).run();
  
  // Clean up old attribution data (keep 1 year)
  const attributionResult = await env.DB.prepare(`
    DELETE FROM attribution 
    WHERE created_at < datetime('now', '-1 year')
  `).run();
  
  console.log(`[SCHEDULER] Cleanup complete: statements=${statementsResult.meta?.changes}, jobs=${jobsResult.meta?.changes}, attribution=${attributionResult.meta?.changes}`);
}
