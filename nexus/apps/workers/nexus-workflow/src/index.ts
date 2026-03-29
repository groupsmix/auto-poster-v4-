import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    service: "nexus-workflow",
    status: "ok",
    version: "0.1.0",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

export default app;
