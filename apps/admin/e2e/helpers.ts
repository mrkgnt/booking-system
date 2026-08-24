import { expect, type Page } from "@playwright/test";

export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL;
export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD;
export const skipIfNoCreds = !OWNER_EMAIL || !OWNER_PASSWORD;

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
}
