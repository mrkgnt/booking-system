import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrors apps/widget/vitest.config.ts: same "@/*" -> "./src/*" alias as
// components.json/tsconfig.json, same node environment (no DOM needed for
// the pure logic this app's test suite covers), same e2e/ exclusion.
// First vitest suite for apps/site (issue #18: this app had no test infra
// before the Site Content CMS build).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(dirname, "./src") } },
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
});
