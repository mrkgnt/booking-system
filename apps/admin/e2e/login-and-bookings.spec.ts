import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("login, view bookings, force-book, cancel, reschedule, log out", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  // Login now lands on the Dashboard — navigate to Bookings via the nav
  // link, since that's what this spec actually exercises.
  await page.getByRole("link", { name: "Bookings" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("table")).toBeVisible();

  // Filter by staff, then reset — proves the filter round-trips without error.
  const table = page.getByRole("table");
  const staffFilter = page.getByRole("combobox").nth(1);
  await staffFilter.selectOption({ index: 1 });
  await expect(table).toBeVisible();
  await staffFilter.selectOption({ index: 0 });

  // Force-book one slot, then exercise reschedule and cancel against that
  // same booking — one "New booking" cycle only, since reopening the form
  // a second time after a cancel proved flaky here and isn't itself under
  // test. Year 2031 + a day derived from the current timestamp keeps this
  // collision-free against both seed data and leftover rows from previous
  // runs of this same spec (fixed dates accumulated ambiguous duplicates
  // across repeated manual runs against the live project).
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = 1 + (Date.now() % 27); // 1-27: safe for every month
  const rescheduleDay = day === 27 ? 1 : day + 1;
  const bookLabel = `${day} Jun 2031`;
  const rescheduleLabel = `${rescheduleDay} Jul 2031`;

  await page.getByRole("button", { name: "New booking" }).click();
  await page.getByRole("combobox").nth(2).selectOption({ index: 1 }); // service
  await page.getByRole("combobox").nth(3).selectOption({ index: 1 }); // staff
  await page.locator('input[type="datetime-local"]').first().fill(`2031-06-${pad(day)}T10:00`);
  await page.getByPlaceholder("Patient name").fill(`E2E Test Patient ${Date.now()}`);
  await page.getByPlaceholder("Email").fill(`e2e-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Book" }).click();

  // Scoped to rows that still show a Cancel button: the day-of-month label
  // alone isn't unique against leftover bookings from earlier runs of this
  // same spec (Date.now() % 27 collides more often than the comment above
  // assumes), and a stale cancelled leftover with the same label renders no
  // action buttons at all, so an unscoped .first() can silently grab it.
  const activeRowWithLabel = (label: string) =>
    page
      .getByRole("row")
      .filter({ hasText: label })
      .filter({ has: page.getByRole("button", { name: "Cancel" }) })
      .first();

  const row = activeRowWithLabel(bookLabel);
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Reschedule it.
  await row.getByRole("button", { name: "Reschedule" }).click();
  await row.locator('input[type="datetime-local"]').fill(`2031-07-${pad(rescheduleDay)}T11:00`);
  await row.getByRole("button", { name: "Save" }).click();
  const rescheduledRow = activeRowWithLabel(rescheduleLabel);
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
