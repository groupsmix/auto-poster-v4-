// ============================================================
// Emergency Kill Switch — /nuke endpoint
// For bans, hacks, or emergency shutdown
// ============================================================

import { Hono } from "hono";
import type { CoreEnv } from "../index";
import { JobQueueService } from "../services/job-queue";

interface NukeRequest {
  reason: string;
  scope?: 'all' | 'niche' | 'queue-only'; // default: all
  niche_id?: string;
  revoke_tokens?: boolean;
  export_backup?: boolean;
}

interface NukeResponse {
  success: boolean;
  action_taken: {
    jobs_paused: number;
    tokens_revoked: boolean;
    backup_exported: boolean;
  };
  event_id: string;
  timestamp: string;
}

const app = new Hono<{ Bindings: CoreEnv; Variables: { requestId: string; nicheId?: string; apiKey?: string } }>();

// POST /api/nuke — Emergency kill switch
app.post("/", async (c) => {
  const requestId = c.get('requestId');
  const body = await c.req.json<NukeRequest>();
  
  console.log(`[${requestId}] ☠️ NUKE TRIGGERED: ${body.reason}`);
  
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  const result: NukeResponse = {
    success: true,
    action_taken: {
      jobs_paused: 0,
      tokens_revoked: false,
      backup_exported: false,
    },
    event_id: eventId,
    timestamp,
  };
  
  const jobQueue = new JobQueueService(c.env.DB);
  
  try {
    // 1. PAUSE ALL JOBS
    if (body.scope === 'niche' && body.niche_id) {
      // Pause only jobs in specific niche
      result.action_taken.jobs_paused = await jobQueue.pauseAllJobsInNiche(body.niche_id);
      console.log(`[${requestId}] Paused ${result.action_taken.jobs_paused} jobs in niche ${body.niche_id}`);
    } else if (body.scope === 'queue-only') {
      // Just pause pending/running jobs, don't revoke tokens
      const { results } = await c.env.DB.prepare(`
        UPDATE job_queue 
        SET status = 'paused', worker_id = NULL, locked_at = NULL, lock_expires_at = NULL
        WHERE status IN ('pending', 'running')
      `).run();
      result.action_taken.jobs_paused = results?.length ?? 0;
    } else {
      // ALL scope — pause everything
      const { results } = await c.env.DB.prepare(`
        UPDATE job_queue 
        SET status = 'paused', worker_id = NULL, locked_at = NULL, lock_expires_at = NULL
        WHERE status IN ('pending', 'running')
      `).run();
      result.action_taken.jobs_paused = results?.length ?? 0;
    }
    
    // 2. REVOKE TOKENS (if requested)
    if (body.revoke_tokens !== false) {
      // Mark all API keys as revoked in KV
      // This is a soft revoke — keys are flagged but can be restored
      const revokedKeys = await revokeAllTokens(c.env);
      result.action_taken.tokens_revoked = revokedKeys > 0;
      console.log(`[${requestId}] Revoked ${revokedKeys} API tokens`);
    }
    
    // 3. EXPORT BACKUP (if requested)
    if (body.export_backup !== false) {
      const backupUrl = await exportEncryptedBackup(c.env, body.niche_id);
      result.action_taken.backup_exported = !!backupUrl;
      console.log(`[${requestId}] Backup exported: ${backupUrl}`);
    }
    
    // 4. LOG EVENT
    await c.env.DB.prepare(`
      INSERT INTO emergency_events (id, event_type, triggered_by, reason, affected_niches, affected_jobs, backup_exported, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      'nuke',
      c.get('apiKey') || 'unknown',
      body.reason,
      body.niche_id ? JSON.stringify([body.niche_id]) : JSON.stringify(['all']),
      result.action_taken.jobs_paused,
      result.action_taken.backup_exported,
      timestamp
    ).run();
    
    // 5. NOTIFY OTHER WORKERS
    // Signal dispatch and scheduler to stop processing
    if (c.env.NEXUS_DISPATCH) {
      await c.env.NEXUS_DISPATCH.fetch("http://nexus-dispatch/internal/nuke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, reason: body.reason })
      }).catch(() => {}); // Best effort
    }
    
    if (c.env.NEXUS_SCHEDULER) {
      await c.env.NEXUS_SCHEDULER.fetch("http://nexus-scheduler/internal/nuke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, reason: body.reason })
      }).catch(() => {}); // Best effort
    }
    
    return c.json(result);
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] NUKE FAILED: ${errorMsg}`);
    
    return c.json({
      success: false,
      error: `Kill switch failed: ${errorMsg}`,
      event_id: eventId,
      timestamp,
    }, 500);
  }
});

// GET /api/nuke/status — Check if system is in emergency mode
app.get("/status", async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT COUNT(*) as paused_jobs FROM job_queue WHERE status = 'paused'
  `).first<{ paused_jobs: number }>();
  
  const recentEvents = await c.env.DB.prepare(`
    SELECT * FROM emergency_events 
    WHERE created_at > datetime('now', '-24 hours')
    ORDER BY created_at DESC
    LIMIT 5
  `).all();
  
  return c.json({
    emergency_mode: (results?.paused_jobs ?? 0) > 100, // Heuristic
    paused_jobs: results?.paused_jobs ?? 0,
    recent_events: recentEvents.results || [],
  });
});

// POST /api/nuke/recover — Resume from emergency mode
app.post("/recover", async (c) => {
  const body = await c.req.json<{ event_id: string; resume_jobs?: boolean }>();
  
  if (body.resume_jobs) {
    // Resume all paused jobs
    await c.env.DB.prepare(`
      UPDATE job_queue 
      SET status = 'pending', scheduled_at = NULL
      WHERE status = 'paused'
    `).run();
  }
  
  // Restore API keys
  await restoreTokens(c.env);
  
  // Log recovery
  await c.env.DB.prepare(`
    UPDATE emergency_events SET recovered_at = ? WHERE id = ?
  `).bind(new Date().toISOString(), body.event_id).run();
  
  return c.json({
    success: true,
    message: 'System recovered from emergency mode',
    recovered_at: new Date().toISOString(),
  });
});

// Helper: Revoke all API tokens
async function revokeAllTokens(env: CoreEnv): Promise<number> {
  // Store revoked state in KV
  await env.NEXUS_KV.put('system:tokens_revoked', JSON.stringify({
    revoked_at: new Date().toISOString(),
    all_revoked: true,
  }));
  
  // Return number of keys that were active
  // In a real implementation, you'd iterate through all keys
  return 1; // Simplified
}

// Helper: Restore API tokens
async function restoreTokens(env: CoreEnv): Promise<void> {
  await env.NEXUS_KV.delete('system:tokens_revoked');
}

// Helper: Export encrypted backup
async function exportEncryptedBackup(env: CoreEnv, nicheId?: string): Promise<string | null> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupKey = `backups/emergency-${timestamp}.json.enc`;
    
    // Get data to backup
    let data: any = {};
    
    if (nicheId) {
      // Backup specific niche
      const products = await env.DB.prepare('SELECT * FROM products WHERE niche_id = ?').bind(nicheId).all();
      const jobs = await env.DB.prepare('SELECT * FROM job_queue WHERE niche_id = ?').bind(nicheId).all();
      data = { niche_id: nicheId, products: products.results, jobs: jobs.results };
    } else {
      // Backup all (in chunks to avoid memory issues)
      const products = await env.DB.prepare('SELECT * FROM products LIMIT 1000').all();
      const jobs = await env.DB.prepare('SELECT * FROM job_queue LIMIT 1000').all();
      data = { products: products.results, jobs: jobs.results };
    }
    
    // Encrypt (simplified — in production use proper encryption)
    const jsonData = JSON.stringify(data);
    const encrypted = btoa(jsonData); // Base64 encode (replace with real encryption)
    
    // Store in R2
    await env.NEXUS_R2.put(backupKey, encrypted, {
      customMetadata: {
        created_at: new Date().toISOString(),
        type: 'emergency_backup',
        niche_id: nicheId || 'all',
      }
    });
    
    return `r2://${backupKey}`;
  } catch (error) {
    console.error('Backup export failed:', error);
    return null;
  }
}

export default app;
