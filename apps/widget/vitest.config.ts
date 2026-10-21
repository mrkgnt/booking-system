import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Mirrors components.json's "@/*" -> "./src/*" alias so vitest can import
  // the same component/lib files the app itself does (e.g. DrawerContent.tsx
  // imports "@/components/ui/card"), without needing a separate parallel
  // set of relative-path-only test doubles.
  resolve: { alias: { "@": path.resolve(dirname, "./src") } },
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
});
