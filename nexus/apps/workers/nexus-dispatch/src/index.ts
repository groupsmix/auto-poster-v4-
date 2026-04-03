// ============================================================
// nexus-dispatch Worker — Platform Publishing + Playwright Fallback
// Replaces: nexus-variation + platform publishing
//
// Responsibilities:
// - Platform API integrations (Twitter, LinkedIn, etc.)
// - Playwright browser automation fallback
// - Content variation/adaptation
// - UTM auto-tagging
// - Conflict detection before publish
// ============================================================

import { Hono } from "hono";

// Route modules
import publish from "./routes/publish";
import platforms from "./routes/platforms";
import internal from "./routes/internal";
import health from "./routes/health";

export interface DispatchEnv {
  // D1 Database (read-only for dispatch)
  DB: D1Database;
  
  // KV for caching
  NEXUS_KV: KVNamespace;
  
  // R2 for assets
  NEXUS_R2: R2Bucket;
  
  // Platform API credentials
  TWITTER_API_KEY?: string;
  TWITTER_API_SECRET?: string;
  TWITTER_ACCESS_TOKEN?: string;
  TWITTER_ACCESS_SECRET?: string;
  
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  LINKEDIN_ACCESS_TOKEN?: string;
  
  // Playwright (browserless or similar)
  PLAYWRIGHT_WS_ENDPOINT?: string;
  
  // UTM defaults
  UTM_SOURCE?: string;
  UTM_MEDIUM?: string;
  
  // Service bindings
  NEXUS_CORE?: Fetcher;
  NEXUS_SCHEDULER?: Fetcher;
}

const app = new Hono<{ Bindings: DispatchEnv; Variables: { requestId: string } }>();

// Request ID middleware
app.use("*", async (c, next) => {
  const requestId = c.req.header("X-Request-ID") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});

// Logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  const requestId = c.get("requestId") ?? "-";
  await next();
  const duration = Date.now() - start;
  console.log(`[${requestId}] ${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`);
});

// Routes
app.route("/publish", publish);
app.route("/platforms", platforms);
app.route("/internal", internal);
app.route("/health", health);

// Root
app.get("/", (c) => c.json({ 
  service: "nexus-dispatch", 
  status: "ok", 
  version: "5.0.0",
  features: ['api_publishing', 'playwright_fallback', 'utm_tagging', 'conflict_detection']
}));

export default {
  async fetch(request: Request, env: DispatchEnv, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  }
};
