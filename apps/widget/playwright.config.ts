import { defineConfig, devices } from "@playwright/test";

// Same pattern as apps/admin/playwright.config.ts — loads apps/widget/.env
// before helpers.ts's module-level process.env reads, so a bare
// `pnpm test:e2e` works without prefixing env vars every run. Falls back to
// whatever's already in the environment (e.g. CI) if .env doesn't exist.
try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on real environment variables instead
}

// Assumes apps/api + apps/widget are already running locally against the
// real Dent Di project (see CLAUDE.md) — deliberately doesn't manage
// servers itself, matching apps/admin/e2e's "no mocked backend" philosophy.
// The spec itself loads a local fixture file (e2e/fixtures/host.html) via
// file://, not baseURL — baseURL is kept for parity with apps/admin and in
// case a future spec needs it (e.g. the standalone cancel/reschedule pages,
// a later ticket).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8082",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
