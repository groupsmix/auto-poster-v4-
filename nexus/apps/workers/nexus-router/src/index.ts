import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => {
  return c.json({
    service: "nexus-router",
    status: "ok",
    version: "0.1.0",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// API routes — will be expanded in later tasks
app.get("/api/workflow", (c) => c.json({ message: "workflow endpoint" }));
app.get("/api/products", (c) => c.json({ message: "products endpoint" }));
app.get("/api/review", (c) => c.json({ message: "review endpoint" }));
app.get("/api/ai", (c) => c.json({ message: "ai endpoint" }));
app.get("/api/platforms", (c) => c.json({ message: "platforms endpoint" }));
app.get("/api/social", (c) => c.json({ message: "social endpoint" }));
app.get("/api/analytics", (c) => c.json({ message: "analytics endpoint" }));
app.get("/api/settings", (c) => c.json({ message: "settings endpoint" }));

export default app;
