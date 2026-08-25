import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("create, edit, and delete a service", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Catalog" }).click();
  await page.getByRole("button", { name: "Services" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const suffix = Date.now();
  const nameLv = `E2E Service LV ${suffix}`;

  await page.getByRole("button", { name: "New service" }).click();
  await page.getByPlaceholder("Name (LV)").fill(nameLv);
  await page.getByPlaceholder("Name (RU)").fill(`E2E Service RU ${suffix}`);
  await page.getByPlaceholder("Name (EN)").fill(`E2E Service EN ${suffix}`);
  await page.locator('input[type="number"]').first().fill("30"); // duration minutes
  await page.getByRole("button", { name: "Save service" }).click();

  const row = page.getByRole("row").filter({ hasText: nameLv });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole("button", { name: "Edit" }).click();
  const editedLv = `${nameLv} (edited)`;
  await page.getByPlaceholder("Name (LV)").fill(editedLv);
  await page.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row").filter({ hasText: editedLv });
  await expect(editedRow).toBeVisible({ timeout: 10_000 });

  page.once("dialog", (d) => d.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: editedLv })).toHaveCount(0);
});
