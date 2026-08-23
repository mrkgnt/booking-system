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
});
