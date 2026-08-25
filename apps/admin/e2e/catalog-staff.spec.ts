import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("create a staff member, edit them, link services, and delete them", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Catalog" }).click();
  await page.getByRole("button", { name: "Staff" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const suffix = Date.now();
  const name = `E2E Staff ${suffix}`;

  await page.getByRole("button", { name: "New staff" }).click();
  await page.getByPlaceholder("Name").fill(name);
  await page.getByRole("button", { name: "Save staff" }).click();

  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Edit.
  await row.getByRole("button", { name: "Edit" }).click();
  const editedName = `${name} (edited)`;
  await page.getByPlaceholder("Name").fill(editedName);
  await page.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row").filter({ hasText: editedName });
  await expect(editedRow).toBeVisible({ timeout: 10_000 });

  // Link services.
  await editedRow.getByRole("button", { name: "Manage services" }).click();
  const firstServiceCheckbox = page.getByRole("checkbox").first();
  await firstServiceCheckbox.check();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Save services" }).click();
  await expect(firstServiceCheckbox).not.toBeVisible(); // panel closes on save

  // Delete.
  page.once("dialog", (d) => d.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: editedName })).toHaveCount(0);
});
