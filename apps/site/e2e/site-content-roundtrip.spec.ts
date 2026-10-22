import { test, expect } from "@playwright/test";
import { loginToAdmin, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

// This is the one test issue #18/#27 call out as the actual reason this
// feature exists: a Site Content edit made through apps/admin's screen
// (ticket #20) must be visible on the live apps/site page with no
// rebuild/redeploy step — proving the cross-app contract (a write via
// apps/admin's API lands in `site_content`, and apps/site's SSR read on
// the very next page load sees it), not just that either screen renders
// what it's handed. `test.skip`s cleanly when credentials are unset,
// matching every other E2E spec in this repo.
test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

// Captured during the test and restored in afterEach — same capture/
// restore precedent as apps/admin/e2e/scheduling-hours.spec.ts and
// apps/admin/e2e/site-content.spec.ts itself, so this spec doesn't leave
// the live Dent Di business's real hero subheadline altered.
let originalSubhead: string | null = null;

test.afterEach(async ({ page }) => {
  if (originalSubhead === null) return;
  const value = originalSubhead;
  originalSubhead = null;

  const subheadInput = page.getByLabel("Subheadline");
  if (!(await subheadInput.isVisible().catch(() => false))) return;

  await subheadInput.fill(value);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/admin/site-content") && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(response.ok()).toBe(true);
});

test("editing the hero subheadline in apps/admin shows up live on apps/site's home page with no rebuild", async ({
  page,
  context,
}) => {
  // 1. Log into apps/admin and open the Site Content screen.
  await loginToAdmin(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Site Content" }).click();
  await expect(page).toHaveURL(/\/site-content$/);

  const subheadInput = page.getByLabel("Subheadline");
  await expect(subheadInput).toBeVisible();

  // 2. Read the current live value first, so it can be restored afterwards.
  originalSubhead = await subheadInput.inputValue();
  expect(originalSubhead.length).toBeGreaterThan(0);

  // 3. Write a new, uniquely identifiable value and save it.
  const nextValue = `E2E roundtrip subhead ${Date.now()}`;
  await subheadInput.fill(nextValue);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/admin/site-content") && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(response.ok()).toBe(true);
  await expect(page.getByRole("status")).toHaveText("Saved.");

  // 4. Load the live apps/site home page in a SEPARATE tab/page, not by
  // navigating `page` itself away from the admin screen — `page` must
  // stay on the Site Content form for the afterEach restore above to find
  // the Subheadline field again. (A real bug during this spec's own
  // development: navigating `page` itself to apps/site here made the
  // afterEach's `getByLabel("Subheadline")` silently find nothing and
  // skip the restore, leaving the live "lv" hero subhead stuck on a test
  // value until manually fixed — see CLAUDE.md's Open Items.)
  const sitePage = await context.newPage();
  await sitePage.goto((process.env.E2E_BASE_URL ?? "http://localhost:4321") + "/");
  await expect(sitePage.getByText(nextValue)).toBeVisible();
  await sitePage.close();
});
