import { defineConfig, devices } from "@playwright/test";

// Same pattern as apps/admin/playwright.config.ts / apps/widget/playwright.config.ts
// — loads apps/site/.env before helpers.ts's module-level process.env reads, so a
// bare `pnpm test:e2e` works without prefixing env vars every run. Falls back to
// whatever's already in the environment (e.g. CI secrets) if .env doesn't exist.
try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on real environment variables instead
}

// Assumes apps/api (:8081), apps/admin (:8080), and apps/site itself (:4321) are
// already running locally against the real Dent Di project — deliberately doesn't
// manage servers itself, matching apps/admin/e2e's and apps/widget/e2e's "no mocked
// backend" philosophy. This suite is unusual among the three in that its specs
// cross apps (login + edit on apps/admin, then read on apps/site) — baseURL stays
// apps/site's own origin since that's where most assertions land; the admin half of
// each spec navigates via an absolute URL (see e2e/helpers.ts's ADMIN_ORIGIN).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4321",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
