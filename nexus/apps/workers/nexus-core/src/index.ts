// ============================================================
// nexus-core Worker — Consolidated API Router + Storage + AI
// Replaces: nexus-router + nexus-storage + nexus-ai (3→1 collapse)
//
// Responsibilities:
// - HTTP API routing (Hono.js)
// - D1/KV/R2 storage operations
// - AI gateway with failover
// - Job queue management (D1 state machine)
// - Authentication (API key + IP whitelist)
// ============================================================

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiResponse } from "@nexus/shared";

// Route modules
import jobs from "./routes/jobs";
import products from "./routes/products";
import niches from "./routes/niches";
import platforms from "./routes/platforms";
import analytics from "./routes/analytics";
import attribution from "./routes/attribution";
import nuke from "./routes/nuke";
import health from "./routes/health";
import ai from "./routes/ai";
import exportRoutes from "./routes/export";
import batch from "./routes/batch";

// Services
import { JobQueueService } from "./services/job-queue";
import { RLSMiddleware } from "./services/rls";

export interface CoreEnv {
  // D1 Database
  DB: D1Database;
  
  // KV Namespace
  NEXUS_KV: KVNamespace;
  
  // R2 Buckets
  NEXUS_R2: R2Bucket;
  
  // AI Gateway
  AI_GATEWAY_URL?: string;
  AI_GATEWAY_TOKEN?: string;
  
  // API Keys (comma-separated for multiple)
  API_KEYS: string;
  
  // IP Whitelist (comma-separated, empty = allow all)
  IP_WHITELIST?: string;
  
  // Service bindings to other workers
  NEXUS_DISPATCH?: Fetcher;
  NEXUS_SCHEDULER?: Fetcher;
}

const app = new Hono<{ Bindings: CoreEnv; Variables: { requestId: string; nicheId?: string; apiKey?: string } }>();

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS — restrict to exact known origins
app.use("*", async (c, next) => {
  const allowedOrigins = c.env.IP_WHITELIST?.split(",").map(s => s.trim()) || [];
  
  return cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (origin.startsWith("http://localhost")) return origin;
      if (allowedOrigins.includes(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Niche-ID"],
    exposeHeaders: ["X-Request-ID", "Retry-After"],
    maxAge: 86400,
  })(c, next);
});

// Request ID tracing
app.use("/api/*", async (c, next) => {
  const requestId = c.req.header("X-Request-ID") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});

// Request logging
app.use("/api/*", async (c, next) => {
  const start = Date.now();
  const requestId = c.get("requestId") ?? "-";
  await next();
  const duration = Date.now() - start;
  console.log(`[${requestId}] ${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`);
});

// Rate limiting (in-memory, per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

app.use("/api/*", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= 500) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json<ApiResponse>({ success: false, error: "Rate limit exceeded" }, 429);
    }
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
  }

  // Cleanup expired entries periodically
  if (Math.random() < 0.01) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }

  await next();
});

// API Key + IP Whitelist Auth
app.use("/api/*", async (c, next) => {
  const requestId = c.get("requestId");
  
  // Skip auth for health check
  if (c.req.path === "/health" || c.req.path === "/") {
    await next();
    return;
  }
  
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json<ApiResponse>({ success: false, error: "Missing or invalid Authorization header" }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  const validKeys = c.env.API_KEYS.split(",").map(k => k.trim());
  
  if (!validKeys.includes(apiKey)) {
    console.log(`[${requestId}] Invalid API key attempted`);
    return c.json<ApiResponse>({ success: false, error: "Invalid API key" }, 401);
  }
  
  c.set("apiKey", apiKey);
  
  // IP Whitelist check
  if (c.env.IP_WHITELIST) {
    const clientIp = c.req.header("CF-Connecting-IP") ?? "unknown";
    const allowedIps = c.env.IP_WHITELIST.split(",").map(ip => ip.trim());
    if (!allowedIps.includes(clientIp)) {
      console.log(`[${requestId}] IP not whitelisted: ${clientIp}`);
      return c.json<ApiResponse>({ success: false, error: "IP not whitelisted" }, 403);
    }
  }
  
  await next();
});

// RLS (Row Level Security) — enforce niche isolation
app.use("/api/*", RLSMiddleware);

// ============================================================
// ROUTES
// ============================================================

app.route("/api/jobs", jobs);
app.route("/api/products", products);
app.route("/api/niches", niches);
app.route("/api/platforms", platforms);
app.route("/api/analytics", analytics);
app.route("/api/attribution", attribution);
app.route("/api/nuke", nuke);
app.route("/api/ai", ai);
app.route("/api/export", exportRoutes);
app.route("/api/batch", batch);

// Health check
app.get("/health", (c) => c.json({ 
  service: "nexus-core", 
  status: "ok", 
  version: "5.0.0",
  timestamp: new Date().toISOString()
}));

app.get("/", (c) => c.json({ 
  service: "nexus-core", 
  status: "ok", 
  version: "5.0.0",
  docs: "/health"
}));

// ============================================================
// CRON TRIGGER — Job Queue Worker
// ============================================================

export default {
  async fetch(request: Request, env: CoreEnv, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  
  // Cron trigger for job queue processing
  async scheduled(event: ScheduledEvent, env: CoreEnv, ctx: ExecutionContext): Promise<void> {
    const jobQueue = new JobQueueService(env.DB);
    
    // Claim and process pending jobs
    const workerId = `core-${crypto.randomUUID().slice(0, 8)}`;
    const jobs = await jobQueue.claimJobs(workerId, 5); // Process 5 at a time
    
    for (const job of jobs) {
      ctx.waitUntil(processJob(job, env));
    }
    
    // Cleanup stale locks
    await jobQueue.releaseStaleLocks(300); // 5 minutes
  }
};

async function processJob(job: any, env: CoreEnv): Promise<void> {
  const jobQueue = new JobQueueService(env.DB);
  
  try {
    await jobQueue.updateJobStatus(job.id, 'running', { started_at: new Date().toISOString() });
    
    // Route to appropriate handler based on job_type
    switch (job.job_type) {
      case 'product_generation':
        // Call nexus-dispatch for AI workflow
        if (env.NEXUS_DISPATCH) {
          await env.NEXUS_DISPATCH.fetch("http://nexus-dispatch/internal/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: job.id, ...job.input_json })
          });
        }
        break;
        
      case 'publish':
        // Publishing handled by dispatch
        if (env.NEXUS_DISPATCH) {
          await env.NEXUS_DISPATCH.fetch("http://nexus-dispatch/internal/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: job.id, ...job.input_json })
          });
        }
        break;
        
      case 'recycle':
        // Content recycling
        if (env.NEXUS_SCHEDULER) {
          await env.NEXUS_SCHEDULER.fetch("http://nexus-scheduler/internal/recycle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: job.id, ...job.input_json })
          });
        }
        break;
        
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
    
    await jobQueue.updateJobStatus(job.id, 'completed', { completed_at: new Date().toISOString() });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await jobQueue.updateJobStatus(job.id, 'failed', { 
      error: errorMsg,
      retry_count: job.retry_count + 1
    });
    
    // Auto-retry if under max_retries
    if (job.retry_count < job.max_retries) {
      await jobQueue.scheduleRetry(job.id, Math.pow(2, job.retry_count) * 60000); // Exponential backoff
    }
  }
}
