import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("force-book rejects a conflicting slot with a visible error, and doesn't duplicate the booking", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  const pad = (n: number) => String(n).padStart(2, "0");
  const day = 1 + (Date.now() % 27);
  const startsAt = `2032-03-${pad(day)}T09:00`;
  const label = `${day} Mar 2032`;

  async function forceBook() {
    await page.getByRole("button", { name: "New booking" }).click();
    await page.getByRole("combobox").nth(2).selectOption({ index: 1 });
    await page.getByRole("combobox").nth(3).selectOption({ index: 1 });
    await page.locator('input[type="datetime-local"]').first().fill(startsAt);
    await page.getByPlaceholder("Patient name").fill(`E2E Conflict Patient ${Date.now()}`);
    await page.getByPlaceholder("Email").fill(`e2e-conflict-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Book" }).click();
  }

  await forceBook();
  const row = page.getByRole("row").filter({ hasText: label });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Same service/staff/time again — must be rejected, not silently duplicated.
  await forceBook();
  await expect(page.getByText("That time slot is no longer available.")).toBeVisible();
  await expect(row).toHaveCount(1);

  // Clean up the one booking that did get created.
  page.once("dialog", (d) => d.accept());
  await row.first().getByRole("button", { name: "Cancel" }).click();
  await expect(row.first().getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("force-book form blocks submission with missing patient contact info", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("button", { name: "New booking" }).click();
  await page.getByRole("combobox").nth(2).selectOption({ index: 1 });
  await page.getByRole("combobox").nth(3).selectOption({ index: 1 });
  await page.locator('input[type="datetime-local"]').first().fill("2032-04-10T09:00");
  // Patient name and email/phone all left blank.
  await page.getByRole("button", { name: "Book" }).click();

  await expect(page.getByText("Patient name is required.")).toBeVisible();
  await expect(page.getByText("Patient email or phone is required.")).toBeVisible();
  // Confirms nothing was submitted to the API: the form is still open.
  await expect(page.getByRole("button", { name: "Book" })).toBeVisible();
});
