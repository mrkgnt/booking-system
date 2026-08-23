import { test, expect } from "@playwright/test";

// Exercises the real Dent Di Supabase project (see CLAUDE.md) — needs
// apps/api and apps/admin already running, and real owner credentials.
// Skips (not fails) when credentials aren't provided, so a bare
// `pnpm exec playwright test` in an unconfigured environment doesn't hang.
const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;

test.skip(!email || !password, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("login, view bookings, force-book, cancel, reschedule, log out", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("table")).toBeVisible();

  // Filter by staff, then reset — proves the filter round-trips without error.
  const table = page.getByRole("table");
  const staffFilter = page.getByRole("combobox").nth(1);
  await staffFilter.selectOption({ index: 1 });
  await expect(table).toBeVisible();
  await staffFilter.selectOption({ index: 0 });

  // Force-book one slot far enough out to avoid colliding with seed data,
  // then exercise reschedule and cancel against that same booking — one
  // "New booking" cycle only, since reopening the form a second time after
  // a cancel proved flaky here and isn't itself under test.
  await page.getByRole("button", { name: "New booking" }).click();
  await page.getByRole("combobox").nth(2).selectOption({ index: 1 }); // service
  await page.getByRole("combobox").nth(3).selectOption({ index: 1 }); // staff
  await page.locator('input[type="datetime-local"]').first().fill("2029-09-10T10:00");
  await page.getByPlaceholder("Patient name").fill(`E2E Test Patient ${Date.now()}`);
  await page.getByPlaceholder("Email").fill(`e2e-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Book" }).click();

  // "Sept 2029" (en-GB Intl formatting abbreviates September as "Sept",
  // not "Sep") — specific enough to avoid matching leftover rows from
  // earlier partial test runs at other 2029 dates.
  const row = page.getByRole("row").filter({ hasText: "Sept 2029" }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Reschedule it.
  await row.getByRole("button", { name: "Reschedule" }).click();
  await row.locator('input[type="datetime-local"]').fill("2029-10-11T11:00");
  await row.getByRole("button", { name: "Save" }).click();
  const rescheduledRow = page.getByRole("row").filter({ hasText: "Oct 2029" });
  await expect(rescheduledRow).toBeVisible({ timeout: 10_000 });

  // Cancel it.
  page.once("dialog", (d) => d.accept());
  await rescheduledRow.getByRole("button", { name: "Cancel" }).click();
  await expect(rescheduledRow.getByRole("button", { name: "Cancel" })).toHaveCount(0);

  // Log out, then confirm the redirect guard still holds.
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/bookings");
  await expect(page).toHaveURL(/\/login$/);
});
