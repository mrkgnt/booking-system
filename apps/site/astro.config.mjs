import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// SSR (not static) — reverted from the original static-output call
// (ADR-0005, issue #21): the schema-driven Site Content CMS this app is
// being built towards needs a saved admin edit to show up on next page
// load with no rebuild step, same requirement apps/admin/apps/widget
// already have. Node adapter is a placeholder, same open hosting
// question as apps/api/apps/admin/apps/widget.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  i18n: {
    defaultLocale: "lv",
    locales: ["lv", "ru", "en"],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
