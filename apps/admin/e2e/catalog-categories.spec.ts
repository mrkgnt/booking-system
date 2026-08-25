import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("create, edit, and delete a service category", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Catalog" }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole("table")).toBeVisible();

  const suffix = Date.now();
  const nameLv = `E2E Category LV ${suffix}`;
  const nameRu = `E2E Category RU ${suffix}`;
  const nameEn = `E2E Category EN ${suffix}`;

  await page.getByRole("button", { name: "New category" }).click();
  await page.getByPlaceholder("Name (LV)").fill(nameLv);
  await page.getByPlaceholder("Name (RU)").fill(nameRu);
  await page.getByPlaceholder("Name (EN)").fill(nameEn);
  await page.getByRole("button", { name: "Save category" }).click();

  const row = page.getByRole("row").filter({ hasText: nameLv });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Edit inline.
  await row.getByRole("button", { name: "Edit" }).click();
  const editedLv = `${nameLv} (edited)`;
  await page.getByPlaceholder("Name (LV)").fill(editedLv);
  await page.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row").filter({ hasText: editedLv });
  await expect(editedRow).toBeVisible({ timeout: 10_000 });

  // Delete.
  page.once("dialog", (d) => d.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: editedLv })).toHaveCount(0);
});
