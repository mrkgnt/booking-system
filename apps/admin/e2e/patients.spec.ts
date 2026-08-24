import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("browse patients, open a detail page, edit and persist notes", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Patients" }).click();
  await expect(page).toHaveURL(/\/patients$/);
  const table = page.getByRole("table");
  await expect(table).toBeVisible();

  const firstRow = page.getByRole("row").nth(1); // nth(0) is the header row
  const patientName = (await firstRow.locator("td").first().textContent())!.trim();
  await firstRow.getByRole("link", { name: "View" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  await expect(page.getByText(patientName)).toBeVisible();

  const note = `E2E note ${Date.now()}`;
  const notesField = page.getByPlaceholder("Notes");
  await notesField.fill(note);
  await page.getByRole("button", { name: "Save" }).click();

  // Reload to prove persistence rather than trusting client-side state.
  await page.reload();
  await expect(page.getByPlaceholder("Notes")).toHaveValue(note);

  await page.getByRole("link", { name: "Back to patients" }).click();
  await expect(page).toHaveURL(/\/patients$/);
});

test("search filters the patients list", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Patients" }).click();

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const initialRows = await page.getByRole("row").count();

  await page.getByPlaceholder("Search patients").fill("zzz-no-such-patient-zzz");
  await expect(page.getByText("No patients found.")).toBeVisible();

  await page.getByPlaceholder("Search patients").fill("");
  await expect(page.getByRole("row")).toHaveCount(initialRows);
});
