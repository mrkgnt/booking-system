import { defineConfig, devices } from "@playwright/test";

// Assumes apps/api and apps/admin are already running locally (see CLAUDE.md
// for launch commands) — deliberately doesn't manage servers itself, since
// e2e specs exercise the real Dent Di Supabase project and shouldn't spin up
// throwaway instances against live data.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
