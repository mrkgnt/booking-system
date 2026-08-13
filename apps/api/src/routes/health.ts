import { Hono } from "hono";

export const healthRoute = new Hono();

// No tenant resolution, no Supabase call — just confirms the server boots.
healthRoute.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});
