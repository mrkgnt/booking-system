import { expect, test } from "@playwright/test";
import { closeHostFixtureServer, hostFixtureUrl } from "./helpers.js";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";

// Booking draft (resume-on-reload), issue #15 — see GLOSSARY.md's
// "Booking draft" term and ADR-0004.
//
// Only the two steps with real customer-entered state worth covering live
// here: an "availability" draft (service picked, nothing else) resumes
// synchronously with no network call; a "contact" draft (a locked-in slot
// + typed-in fields) resumes only after a live GET /availability
// revalidation confirms the slot is still free. The "slot was taken while
// away" bounce-back is deliberately NOT covered here, same reasoning
// booking-flow.spec.ts gives for not racing a real steal against this
// suite's shared live "dentdi" data — it's covered deterministically by
// test/lib/booking/draft-resume.test.ts's unit test instead.
test.describe("Booking draft resume-on-reload (issue #15)", () => {
  test.beforeAll(async () => {
    // Same live-tenant-readiness gap documented in booking-flow.spec.ts —
    // this check is live/dynamic, so the suite starts running for real the
    // moment "dentdi" flips to "active", no code change needed here.
    const res = await fetch(`${API_BASE_URL}/public/tenant-info`, { headers: { "X-Tenant-Slug": "dentdi" } });
    test.skip(
      !res.ok,
      `live "dentdi" tenant isn't "active" yet (GET /public/tenant-info -> ${res.status}) — see CLAUDE.md`,
    );
  });

  test.afterAll(async () => {
    await closeHostFixtureServer();
  });

  test("resumes at the availability step after picking a service and reloading", async ({ page }) => {
    const url = await hostFixtureUrl();
    await page.goto(url);
    await page.locator("#platform-widget-trigger").click();

    let frame = page.frameLocator("iframe");
    await frame.getByRole("heading", { name: "Choose a service" }).waitFor();
    await frame.getByRole("button", { name: "Continue" }).click();
    await frame.getByRole("heading", { name: "Pick a time" }).waitFor();

    // sessionStorage survives a same-tab reload (only a real browser
    // session/tab close clears it) — exactly the scenario this ticket is
    // for: an accidental page reload mid-booking.
    await page.reload();
    await page.locator("#platform-widget-trigger").click();

    frame = page.frameLocator("iframe");
    await expect(frame.getByRole("heading", { name: "Pick a time" })).toBeVisible();
  });

  test("resumes at the contact step with typed-in fields intact after reloading", async ({ page }) => {
    const url = await hostFixtureUrl();
    await page.goto(url);
    await page.locator("#platform-widget-trigger").click();

    let frame = page.frameLocator("iframe");
    await frame.getByRole("heading", { name: "Choose a service" }).waitFor();
    await frame.getByRole("button", { name: "Continue" }).click();

    await frame.getByRole("heading", { name: "Pick a time" }).waitFor();
    const dayCell = frame.locator("[data-day]:not([data-disabled='true']) button").first();
    await dayCell.click();
    const slotButton = frame.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
    await slotButton.waitFor({ timeout: 5000 });
    await slotButton.click();

    await frame.getByRole("heading", { name: "Your details" }).waitFor();
    const draftName = `Draft Resume E2E ${Date.now()}`;
    const draftEmail = `widget-draft-e2e-${Date.now()}@example.com`;
    await frame.getByLabel("Name").fill(draftName);
    await frame.getByLabel("Email").fill(draftEmail);

    await page.reload();
    await page.locator("#platform-widget-trigger").click();

    // The resumed draft's slot is re-validated against a fresh
    // GET /availability before landing here — briefly shows the
    // locale-aware "resuming" note first.
    frame = page.frameLocator("iframe");
    await expect(frame.getByRole("heading", { name: "Your details" })).toBeVisible();
    await expect(frame.getByLabel("Name")).toHaveValue(draftName);
    await expect(frame.getByLabel("Email")).toHaveValue(draftEmail);
  });

  test("clears the draft after a successful booking, so reopening starts fresh", async ({ page }) => {
    const url = await hostFixtureUrl();
    await page.goto(url);
    await page.locator("#platform-widget-trigger").click();

    const frame = page.frameLocator("iframe");
    await frame.getByRole("heading", { name: "Choose a service" }).waitFor();
    await frame.getByRole("button", { name: "Continue" }).click();

    await frame.getByRole("heading", { name: "Pick a time" }).waitFor();
    const dayCell = frame.locator("[data-day]:not([data-disabled='true']) button").first();
    await dayCell.click();
    const slotButton = frame.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
    await slotButton.waitFor({ timeout: 5000 });
    await slotButton.click();

    await frame.getByRole("heading", { name: "Your details" }).waitFor();
    await frame.getByLabel("Name").fill("Draft Clear E2E");
    await frame.getByLabel("Email").fill(`widget-draft-clear-e2e-${Date.now()}@example.com`);
    await frame.getByLabel(/I agree to be contacted/).click();
    await frame.getByRole("button", { name: "Book appointment" }).click();

    await frame.getByRole("heading", { name: "Almost done" }).waitFor();
    await frame.getByRole("button", { name: /Dev: confirm now/ }).click();
    await expect(frame.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

    // The draft was cleared the moment POST /bookings succeeded, well
    // before confirm/this assertion — reloading and reopening now should
    // start completely fresh, not resume the now-stale "contact" draft.
    await page.reload();
    await page.locator("#platform-widget-trigger").click();
    const freshFrame = page.frameLocator("iframe");
    await expect(freshFrame.getByRole("heading", { name: "Choose a service" })).toBeVisible();
  });
});
