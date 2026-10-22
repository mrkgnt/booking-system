import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrors apps/widget/vitest.config.ts — first vitest suite for apps/site
// (issue #18/#25: this app had no test infra before the Site Content CMS
// build). Alias matches components.json's "@/*" -> "./src/*" so tests can
// import the same lib files the app itself does.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(dirname, "./src") } },
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
});
