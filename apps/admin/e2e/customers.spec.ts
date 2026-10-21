import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

// Dent Di's site_config.customerLabel is set to {"Patient","Patients"} (see
// ADR-0002 / docs/agents's db note) so its staff keep seeing "Patients" even
// though the underlying domain term and routes are now the generic
// "customers" — these assertions check the configured label's text, not a
// hardcoded one.

test("browse customers, open a detail page, edit and persist notes", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Patients" }).click();
  await expect(page).toHaveURL(/\/customers$/);
  const table = page.getByRole("table");
  await expect(table).toBeVisible();

  const firstRow = page.getByRole("row").nth(1); // nth(0) is the header row
  const customerName = (await firstRow.locator("td").first().textContent())!.trim();
  await firstRow.getByRole("link", { name: "View" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}$/);
  // getByRole("heading") rather than getByText: the astro dev toolbar embeds
  // every island's serialized props (including customer.name) in a hidden
  // debug <code> block that's still present in the DOM, so a plain
  // getByText(customerName) matches it too and trips a strict-mode violation.
  await expect(page.getByRole("heading", { name: customerName })).toBeVisible();

  const note = `E2E note ${Date.now()}`;
  const notesField = page.getByPlaceholder("Notes");
  await notesField.fill(note);
  // Wait for the PATCH itself, not just the click dispatch — page.reload()
  // does a one-shot SSR read with no polling safety net, so reloading before
  // the save actually lands would show a stale value for the full assertion
  // timeout rather than eventually catching up.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/admin/customers/") && r.request().method() === "PATCH"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(response.ok()).toBe(true);

  // Reload to prove persistence rather than trusting client-side state.
  await page.reload();
  await expect(page.getByPlaceholder("Notes")).toHaveValue(note);

  await page.getByRole("link", { name: "Back to patients" }).click();
  await expect(page).toHaveURL(/\/customers$/);
});

test("search filters the customers list", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Patients" }).click();

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const initialRows = await page.getByRole("row").count();

  await page.getByPlaceholder("Search patients").fill("zzz-no-such-customer-zzz");
  await expect(page.getByText("No patients found.")).toBeVisible();

  await page.getByPlaceholder("Search patients").fill("");
  // Not toHaveCount(initialRows): other specs' force-book flows create new
  // customers concurrently via find-or-create, so the total can only grow
  // during this test's run, never shrink — exact equality is what actually
  // flakes under parallel load, not the filtering behavior being asserted.
  await expect(async () => {
    expect(await page.getByRole("row").count()).toBeGreaterThanOrEqual(initialRows);
  }).toPass();
});
