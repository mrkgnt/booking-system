import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// SSR (not static) — src/middleware.ts (Task 6) must run on every request.
// Node adapter is a placeholder, same open question as apps/api's hosting
// (Workers vs. Vercel) — revisit together once that's decided.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
  // Fixed, not Astro's default 4321 — must match apps/api's
  // ADMIN_APP_ORIGIN (see apps/api/.env) or every browser-side /admin/*
  // call gets silently CORS-rejected while SSR-side calls keep working,
  // which is a confusing split to debug from symptoms alone.
  server: { port: 8080 },
});
