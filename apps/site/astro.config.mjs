import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Static output — unlike apps/admin/apps/widget, this app has no
// per-request logic (no auth, no per-request CSP header): it's a brochure
// site that embeds apps/widget's embed.js for the actual booking flow, so
// a plain static build is simplest to host.
export default defineConfig({
  i18n: {
    defaultLocale: "lv",
    locales: ["lv", "ru", "en"],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
