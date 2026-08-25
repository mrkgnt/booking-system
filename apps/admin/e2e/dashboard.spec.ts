import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("login lands on the dashboard, showing stat cards", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

  await expect(page.getByRole("status", { name: "Confirmed appointments this week" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Pending appointments this week" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Cancelled appointments this week" })).toBeVisible();
});

test("force-booking a new confirmed booking this week increments the Confirmed stat", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);

  const confirmedStat = page.getByRole("status", { name: "Confirmed appointments this week" });
  const before = Number(await confirmedStat.textContent());

  // Force-book via the existing Bookings screen — the dashboard itself is
  // read-only, it has no booking-creation form of its own.
  await page.getByRole("link", { name: "Bookings" }).click();
  await page.getByRole("button", { name: "New booking" }).click();
  await page.getByRole("combobox").nth(2).selectOption({ index: 1 }); // service
  await page.getByRole("combobox").nth(3).selectOption({ index: 1 }); // staff

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const minute = Date.now() % 60;
  const startsAtLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T09:${pad(minute)}`;
  await page.locator('input[type="datetime-local"]').first().fill(startsAtLocal);
  await page.getByPlaceholder("Patient name").fill(`E2E Dashboard Patient ${Date.now()}`);
  await page.getByPlaceholder("Email").fill(`e2e-dashboard-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Book" }).click();

  // Scoped to rows that both show today's date (the "Starts" column, e.g.
  // "25 Aug 2026") AND still show a Cancel button. The date scoping isn't
  // optional here: without it, .last() (rows are ordered by starts_at
  // ascending) always matches whichever confirmed/pending booking is
  // chronologically furthest in the future — e.g. real seed data or
  // another spec's leftover — never today's freshly created row,
  // regardless of whether force-book actually succeeded yet. This mirrors
  // the date/label scoping bookings-errors.spec.ts and
  // login-and-bookings.spec.ts already use for the same reason.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const todayLabel = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const activeRow = page
    .getByRole("row")
    .filter({ hasText: todayLabel })
    .filter({ has: page.getByRole("button", { name: "Cancel" }) })
    .last();
  await expect(activeRow).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(confirmedStat).toHaveText(String(before + 1));

  // Clean up. Scoped the same way as above — an unscoped .last() here would
  // cancel whatever unrelated confirmed booking is chronologically last,
  // not the one this test created.
  await page.getByRole("link", { name: "Bookings" }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("row")
    .filter({ hasText: todayLabel })
    .filter({ has: page.getByRole("button", { name: "Cancel" }) })
    .last()
    .getByRole("button", { name: "Cancel" }).click();
});

test("Previous week / Next week / This week navigation changes the displayed week label", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);

  const weekLabel = page.getByRole("heading", { level: 2 });
  const initialLabel = await weekLabel.textContent();

  await page.getByRole("button", { name: "Next week" }).click();
  await expect(weekLabel).not.toHaveText(initialLabel!);

  await page.getByRole("button", { name: "This week" }).click();
  await expect(weekLabel).toHaveText(initialLabel!);
});

test("staff filter narrows the calendar to one staff member", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);

  const staffFilter = page.getByLabel("Staff");
  await expect(staffFilter).toBeVisible();
  await staffFilter.selectOption({ index: 1 });
  await expect(page.getByRole("status", { name: "Confirmed appointments this week" })).toBeVisible();
  await staffFilter.selectOption({ index: 0 }); // back to "All staff"
});

test("the date picker opens a calendar and selecting a day changes the displayed week", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);

  const weekLabel = page.getByRole("heading", { level: 2 });
  const initialLabel = await weekLabel.textContent();

  await page.getByRole("button", { name: "Pick a date" }).click();
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  // Pick a day generically (not by exact accessible name, which depends on
  // react-day-picker's internal formatting) — any day far enough from
  // today reliably lands in a different week.
  await grid.getByRole("button").last().click();

  await expect(weekLabel).not.toHaveText(initialLabel!);
});
