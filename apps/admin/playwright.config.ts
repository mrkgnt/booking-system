import { defineConfig, devices } from "@playwright/test";

// Picks up E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD (and anything else) from
// apps/admin/.env, same file astro dev already reads — so a bare
// `pnpm test:e2e` works without having to pass them inline every time.
// Loaded before helpers.ts's module-level process.env reads, since
// Playwright evaluates this config before requiring any spec file. Falls
// back to whatever's already in the environment (e.g. CI secrets) if
// .env doesn't exist.
try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on real environment variables instead
}

// Assumes apps/api and apps/admin are already running locally (see CLAUDE.md
// for launch commands) — deliberately doesn't manage servers itself, since
// e2e specs exercise the real Dent Di Supabase project and shouldn't spin up
// throwaway instances against live data.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  // Default is 5s. Several specs do an action then assert eventual UI state
  // (delete-then-list-refresh, etc.) — the app logic awaits its own API
  // calls correctly, but the full round-trip across 6 parallel workers
  // hitting one local dev server can occasionally exceed 5s under
  // contention. 10s gives real races (missing awaits) room to still fail
  // while absorbing that load variance.
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
