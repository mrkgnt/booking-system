import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// SSR (not static) — the /drawer route needs to set a
// Content-Security-Policy: frame-ancestors * response header per-request
// (see src/middleware.ts) and server-side-fetch GET /public/tenant-info
// using the tenant slug from its own request URL. Node adapter is a
// placeholder, same open hosting question as apps/api/apps/admin.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
  // Fixed, not Astro's default 4321 — apps/admin pins 8080. The original
  // plan was 8081, but this dev environment's apps/api/.env itself runs
  // on PORT=8081 (not the 8787 documented in apps/api/.env.example), so
  // 8081 would collide with apps/api, not avoid a collision with it — use
  // 8082 instead. Unlike admin, there's no CORS-origin-matching
  // requirement forcing an exact number (the widget calls apps/api's
  // wide-open /public/* CORS, not an origin allowlist) — it's just for
  // collision-free local dev.
  server: { port: 8082 },
});
