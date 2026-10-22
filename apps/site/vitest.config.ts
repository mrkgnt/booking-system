import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrors apps/widget/vitest.config.ts exactly — same "@/*" -> "./src/*"
// alias as components.json/tsconfig.json, no browser environment needed
// since what's tested here is pure logic (no DOM, no Astro render).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(dirname, "./src") } },
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
});
