import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

// Captured during the test and restored in afterEach, so this spec doesn't
// leave the live Dent Di business's real hero subheadline altered — same
// capture/restore precedent as scheduling-hours.spec.ts's Monday-opens-at
// test.
let originalSubhead: string | null = null;

test.afterEach(async ({ page }) => {
  if (originalSubhead === null) return;
  const value = originalSubhead;
  originalSubhead = null;

  const subheadInput = page.getByLabel("Subheadline");
  const saveButton = page.getByRole("button", { name: "Save" });

  if (!(await subheadInput.isVisible().catch(() => false))) return;

  await subheadInput.fill(value);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/admin/site-content") && r.request().method() === "PUT"),
    saveButton.click(),
  ]);
  expect(response.ok()).toBe(true);
});

test("view and edit the home page's hero subheadline", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Site Content" }).click();
  await expect(page).toHaveURL(/\/site-content$/);

  await expect(page.getByRole("heading", { name: "Hero" })).toBeVisible();

  const subheadInput = page.getByLabel("Subheadline");
  await expect(subheadInput).toBeVisible();

  originalSubhead = await subheadInput.inputValue();
  expect(originalSubhead.length).toBeGreaterThan(0); // hero.subhead is real seeded content, not blank

  const nextValue = `E2E subhead ${Date.now()}`;
  await subheadInput.fill(nextValue);

  const saveButton = page.getByRole("button", { name: "Save" });
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/admin/site-content") && r.request().method() === "PUT"),
    saveButton.click(),
  ]);
  expect(response.ok()).toBe(true);
  await expect(page.getByRole("status")).toHaveText("Saved.");

  await page.reload();
  await expect(page.getByLabel("Subheadline")).toHaveValue(nextValue);
});

test("locale switcher shows each locale's own content, and a shared field isn't re-prompted per locale", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Site Content" }).click();
  await expect(page).toHaveURL(/\/site-content$/);

  // Shared (localized: false) field — visible once, same value, under any locale.
  await expect(page.getByLabel("Image URLs (one per line)")).toBeVisible();

  const localeSwitcher = page.getByRole("combobox", { name: "Locale" });
  await expect(localeSwitcher).toBeVisible();

  await localeSwitcher.click();
  await page.getByRole("option", { name: "EN" }).click();
  await expect(page.getByLabel("Image URLs (one per line)")).toBeVisible();
});

test("blocks Save and shows a validation message when a required field is cleared", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Site Content" }).click();
  await expect(page).toHaveURL(/\/site-content$/);

  // { exact: true } matters here — "Subheadline"'s label text contains
  // "Headline" as a substring, so a loose match resolves to both fields.
  const headlineInput = page.getByLabel("Headline", { exact: true });
  const originalHeadline = await headlineInput.inputValue();

  await headlineInput.fill("");
  await page.getByRole("button", { name: "Save" }).click();

  // The validation message appears and no PUT request is ever sent — the
  // Promise.race below treats a PUT firing within the window as a failure.
  await expect(page.getByRole("alert")).toContainText("required");

  // Restore the in-memory field — nothing was ever persisted, since Save
  // was blocked client-side before any network call.
  await headlineInput.fill(originalHeadline);
});
