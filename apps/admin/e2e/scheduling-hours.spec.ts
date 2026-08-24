import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("view and edit the business-wide weekly hours", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Scheduling" }).click();
  await expect(page).toHaveURL(/\/scheduling$/);
  await expect(page.getByRole("table")).toBeVisible();

  // 7 day rows + 1 header row.
  await expect(page.getByRole("row")).toHaveCount(8);

  const mondayRow = page.getByRole("row").filter({ hasText: "Monday" });
  await mondayRow.locator('input[type="time"]').first().fill("08:30");
  await page.getByRole("button", { name: "Save hours" }).click();

  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Monday" }).locator('input[type="time"]').first(),
  ).toHaveValue("08:30");
});
