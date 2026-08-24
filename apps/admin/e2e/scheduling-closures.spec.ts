import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("create and delete a business-wide closure", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Scheduling" }).click();
  await page.getByRole("button", { name: "Closures" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const day = 1 + (Date.now() % 27);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startsOn = `2033-05-${pad(day)}`;
  const endsOn = `2033-05-${pad(day)}`;
  const reason = `E2E closure ${Date.now()}`;

  await page.getByRole("button", { name: "New closure" }).click();
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(startsOn);
  await dateInputs.nth(1).fill(endsOn);
  await page.getByPlaceholder("Reason (optional)").fill(reason);
  await page.getByRole("button", { name: "Save closure" }).click();

  const row = page.getByRole("row").filter({ hasText: reason });
  await expect(row).toBeVisible({ timeout: 10_000 });

  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: reason })).toHaveCount(0);
});
