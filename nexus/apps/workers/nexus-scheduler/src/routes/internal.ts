// ============================================================
// Internal Routes — For service-to-service communication
// ============================================================

import { Hono } from "hono";
import type { SchedulerEnv } from "../index";
import { ContentRecycler } from "../services/content-recycler";
import { GitMirror } from "../services/git-mirror";

const app = new Hono<{ Bindings: SchedulerEnv; Variables: { requestId: string } }>();

// POST /internal/recycle — Trigger content recycling
app.post("/recycle", async (c) => {
  const body = await c.req.json<{ job_id: string; niche_id: string }>();
  
  const recycler = new ContentRecycler(c.env);
  await recycler.recycleNiche(body.niche_id);
  
  return c.json({ success: true, message: 'Recycling completed' });
});

// POST /internal/nuke — Emergency shutdown signal
app.post("/nuke", async (c) => {
  const body = await c.req.json<{ event_id: string; reason: string }>;
  
  console.log(`[SCHEDULER] NUKE received: ${body.reason}`);
  
  // Stop all cron processing
  // (In practice, you'd set a flag in KV to pause processing)
  await c.env.NEXUS_KV.put('system:emergency_mode', JSON.stringify({
    event_id: body.event_id,
    reason: body.reason,
    paused_at: new Date().toISOString(),
  }));
  
  return c.json({ success: true, message: 'Scheduler paused' });
});

// GET /internal/stats — Get scheduler stats
app.get("/stats", async (c) => {
  const recycler = new ContentRecycler(c.env);
  const gitMirror = new GitMirror(c.env);
  
  const [recyclerStats, gitStatus] = await Promise.all([
    recycler.getStats(),
    gitMirror.getStatus(),
  ]);
  
  // Get job queue stats from core
  let jobStats = { pending: 0, running: 0, completed: 0, failed: 0 };
  try {
    const response = await c.env.NEXUS_CORE?.fetch("http://nexus-core/api/jobs/stats", {
      headers: { "X-Niche-ID": "default" }
    });
    if (response) {
      const data = await response.json();
      jobStats = data.data || jobStats;
    }
  } catch {
    // Core might be unavailable
  }
  
  return c.json({
    success: true,
    data: {
      job_queue: jobStats,
      recycling: recyclerStats,
      git_mirror: gitStatus,
      timestamp: new Date().toISOString(),
    }
  });
});

// POST /internal/telegram/webhook — Telegram webhook handler
app.post("/telegram/webhook", async (c) => {
  // This is a passthrough - the main handler is in index.ts
  // But we can add additional processing here
  return c.json({ ok: true });
});

export default app;
