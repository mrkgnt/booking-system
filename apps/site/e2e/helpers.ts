import { expect, type Page } from "@playwright/test";

export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL;
export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD;
export const skipIfNoCreds = !OWNER_EMAIL || !OWNER_PASSWORD;

// apps/admin's own origin — this suite's specs cross apps (log in and edit on
// apps/admin, then read the result on apps/site, this app's own baseURL), unlike
// apps/admin/e2e's and apps/widget/e2e's single-app specs. Overridable the same
// way apps/admin/playwright.config.ts's baseURL is, via an env var, for
// non-default local setups.
export const ADMIN_ORIGIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:8080";

// Mirrors apps/admin/e2e/helpers.ts's login() exactly, but navigates by absolute
// URL since apps/admin isn't this config's baseURL.
export async function loginToAdmin(page: Page, email: string, password: string): Promise<void> {
  await page.goto(ADMIN_ORIGIN + "/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
