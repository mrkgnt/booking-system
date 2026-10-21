import { expect, test } from "@playwright/test";
import {
  closeTenantInfoStubServer,
  startTenantInfoStubServer,
  stubServerBaseUrl,
} from "./fixtures/tenant-info-stub-server.js";
import { startWidgetDevInstance, stopWidgetDevInstance } from "./fixtures/widget-dev-instance.js";

// Issue #13 — in-drawer locale switcher. Navigates directly to the real
// /drawer route (not via embed.js's iframe — that embedding mechanism is
// already covered by embed.spec.ts; this spec is about DrawerContent's
// own rendering/interaction) on a DEDICATED, disposable apps/widget dev
// instance whose API_BASE_URL points at a local stub standing in for
// apps/api's GET /public/tenant-info (see fixtures/tenant-info-stub-server.ts
// for why a stub, not the live Dent Di project, is used here specifically).
//
// This spec manages its own server pair and doesn't touch whatever
// "normal" apps/widget/apps/api instances (ports 8082/8081) the rest of
// apps/widget/e2e assumes are already running.
const WIDGET_PORT = 8199;

test.describe("In-drawer locale switcher", () => {
  test.beforeAll(async () => {
    await startTenantInfoStubServer();
    await startWidgetDevInstance(WIDGET_PORT, stubServerBaseUrl());
  });

  test.afterAll(async () => {
    await stopWidgetDevInstance();
    await closeTenantInfoStubServer();
  });

  test("renders the switcher when the tenant supports more than one locale", async ({ page }) => {
    await page.goto(`http://localhost:${WIDGET_PORT}/drawer?tenant=multi-locale-tenant`);

    await expect(page.getByRole("heading", { name: "Multi Locale Clinic (EN)" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Language" })).toBeVisible();
  });

  test("never renders the switcher for a single-locale tenant", async ({ page }) => {
    await page.goto(`http://localhost:${WIDGET_PORT}/drawer?tenant=single-locale-tenant`);

    await expect(page.getByRole("heading", { name: "Single Locale Clinic (EN)" })).toBeVisible();
    await expect(page.locator('[data-testid="locale-switcher"]')).toHaveCount(0);
    await expect(page.getByRole("combobox")).toHaveCount(0);
  });

  test("switching locale updates the drawer's visible copy without a full page reload", async ({ page }) => {
    await page.goto(`http://localhost:${WIDGET_PORT}/drawer?tenant=multi-locale-tenant`);
    await expect(page.getByRole("heading", { name: "Multi Locale Clinic (EN)" })).toBeVisible();

    // A marker that only survives as long as the page is never reloaded/
    // renavigated — proves the upcoming locale switch is a pure client-side
    // re-fetch+re-render, not window.location.reload(), per this ticket's
    // acceptance criteria.
    await page.evaluate(() => {
      (window as unknown as { __e2eNoReloadMarker?: boolean }).__e2eNoReloadMarker = true;
    });

    await page.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "RU" }).click();

    // getByRole("heading", ...), not a page-wide getByText — Astro's dev
    // toolbar serializes the island's ORIGINAL SSR props into a hidden
    // <code> block for its own debugging UI, which never updates after a
    // client-side state change and would otherwise false-positive-match a
    // page-wide text search for the stale "(EN)" string (the same known
    // pattern already documented in CLAUDE.md for apps/admin's E2E suite).
    // Scoping to the actual visible <h1> avoids that collision entirely.
    await expect(page.getByRole("heading", { name: "Multi Locale Clinic (RU)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Multi Locale Clinic (EN)" })).toHaveCount(0);

    const markerSurvived = await page.evaluate(
      () => (window as unknown as { __e2eNoReloadMarker?: boolean }).__e2eNoReloadMarker === true,
    );
    expect(markerSurvived).toBe(true);
  });
});
