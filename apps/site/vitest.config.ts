import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrors apps/widget/vitest.config.ts: same "@/*" -> "./src/*" alias as
// components.json, same node environment (no DOM needed for the pure
// logic this app's test suite covers), same e2e/ exclusion.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(dirname, "./src") } },
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
});
