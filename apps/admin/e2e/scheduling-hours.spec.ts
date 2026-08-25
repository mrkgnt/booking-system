import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

// Captured during the test and restored in afterEach, so this spec doesn't
// leave the live Dent Di business's real Monday opening time altered.
let originalMondayOpensAt: string | null = null;

test.afterEach(async ({ page }) => {
  if (originalMondayOpensAt === null) return;
  const value = originalMondayOpensAt;
  originalMondayOpensAt = null;

  const mondayOpensInput = page
    .getByRole("row")
    .filter({ hasText: "Monday" })
    .locator('input[type="time"]')
    .first();
  const saveButton = page.getByRole("button", { name: "Save hours" });

  // Only attempt the restore if we're still on a page with the hours table
  // (e.g. the test didn't fail before reaching the mutation).
  if (!(await mondayOpensInput.isVisible().catch(() => false))) return;

  await mondayOpensInput.fill(value);
  await saveButton.click();
  await expect(saveButton).toBeEnabled();
});

test("view and edit the business-wide weekly hours", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Scheduling" }).click();
  await expect(page).toHaveURL(/\/scheduling$/);
  await expect(page.getByRole("table")).toBeVisible();

  // 7 day rows + 1 header row.
  await expect(page.getByRole("row")).toHaveCount(8);

  const mondayRow = page.getByRole("row").filter({ hasText: "Monday" });
  const mondayOpensInput = mondayRow.locator('input[type="time"]').first();
  const saveButton = page.getByRole("button", { name: "Save hours" });

  // Capture the pre-existing value before mutating, so afterEach can restore it.
  originalMondayOpensAt = await mondayOpensInput.inputValue();

  await mondayOpensInput.fill("08:30");
  await saveButton.click();
  // The backend does a delete-then-insert for this endpoint; wait for the
  // save to actually settle (the button re-enables when `saving` clears)
  // before reloading, instead of racing the request with `page.reload()`.
  await expect(saveButton).toBeEnabled();

  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Monday" }).locator('input[type="time"]').first(),
  ).toHaveValue("08:30");
});
