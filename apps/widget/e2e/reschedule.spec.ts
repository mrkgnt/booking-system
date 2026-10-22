import { expect, test, type Page } from "@playwright/test";
import { createConfirmedTestBooking, WIDGET_ORIGIN } from "./helpers.js";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";

// Same calendar-day search booking-flow.spec.ts's pickFirstAvailableSlot
// uses — the current day's own default calendar view often has nothing
// open, so this clicks forward through days until a slot button appears.
async function pickFirstAvailableSlot(page: Page): Promise<void> {
  const today = new Date();
  for (let offset = 0; offset < 28; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`;

    const dayCell = page.locator(`[data-day="${dateKey}"]:not([data-disabled="true"]) button`);
    if ((await dayCell.count()) === 0) continue;

    await dayCell.click();
    const slotButton = page.locator("button").filter({ hasText: /^\d{1,2}:\d{2}(\s?[AP]M)?$/i }).first();
    const noSlots = page.getByText("No available times on this date.");
    await Promise.race([slotButton.waitFor({ timeout: 5000 }), noSlots.waitFor({ timeout: 5000 })]).catch(() => {});
    if (await slotButton.count()) {
      await slotButton.click();
      return;
    }
  }
  throw new Error("No available slot found in the next 28 days against the live project — can't proceed");
}

// Reschedule via the Drawer (issue #16) — a standalone top-level page
// (no iframe), reached directly from the reschedule link in a
// confirmation email. Unlike the embedded booking flow, this page's own
// endpoints (GET /public/bookings/lookup, POST /bookings/reschedule)
// don't depend on business_profile.status, so this runs as a real,
// unconditional E2E test against live data — see helpers.ts's
// createConfirmedTestBooking for how the test booking is minted without
// going through the still-gated catalog display.
//
// Known local-only flakiness source: apps/api's rate limiter is a single
// in-memory bucket shared across every route and, locally, every caller
// (no reverse proxy to supply distinct IPs — see rate-limit.ts's own
// comment), capped at RATE_LIMIT_MAX_ATTEMPTS (5 per 15min by default).
// Each full-lifecycle test below makes 3 mutating calls (create, confirm,
// then reschedule/cancel); running this file back-to-back with
// booking-flow.spec.ts (also real-booking-creating) in the same dev
// server process can exceed that budget and surface as `cancelRes.ok`/
// booking-creation failures unrelated to this ticket's own logic — a
// pre-existing, separately tracked limitation (CLAUDE.md's Open Items:
// "Real rate-limiting infra... once hosting is decided"), not something
// to work around here.
test.describe("Reschedule via the Drawer (issue #16)", () => {
  test("shows the existing booking, then rescheduling to a new time succeeds", async ({ page }) => {
    const booking = await createConfirmedTestBooking(API_BASE_URL);

    await page.goto(`${WIDGET_ORIGIN}/dentdi/reschedule?token=${booking.rescheduleToken}`);

    await expect(page.getByRole("heading", { name: "Reschedule your appointment" })).toBeVisible();
    // Shows the EXISTING date/time before anything is picked.
    await expect(page.getByText(new Date(booking.startsAt).getFullYear().toString())).toBeVisible();

    await page.getByRole("button", { name: "Pick a new time" }).click();
    await expect(page.getByRole("heading", { name: "Pick a time" })).toBeVisible();
    // No staff selector — apps/api's /bookings/reschedule contract only
    // accepts a new time, not a new staff member (issue #16's own scope).
    await expect(page.getByLabel("Staff member")).toHaveCount(0);

    await pickFirstAvailableSlot(page);

    await expect(page.getByRole("heading", { name: "Booking rescheduled" })).toBeVisible();
  });

  test("an invalid token shows a clear error instead of a broken picker", async ({ page }) => {
    await page.goto(`${WIDGET_ORIGIN}/dentdi/reschedule?token=not-a-real-token-value`);
    await expect(page.getByText(/reschedule link is invalid or has expired/)).toBeVisible();
  });

  test("a missing token shows the same clear error", async ({ page }) => {
    await page.goto(`${WIDGET_ORIGIN}/dentdi/reschedule`);
    await expect(page.getByText(/reschedule link is invalid or has expired/)).toBeVisible();
  });

  test("an already-cancelled booking shows an already-actioned state, not the picker", async ({ page }) => {
    const booking = await createConfirmedTestBooking(API_BASE_URL);
    const cancelRes = await fetch(`${API_BASE_URL}/bookings/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": "dentdi" },
      body: JSON.stringify({ token: booking.cancelToken }),
    });
    expect(cancelRes.ok).toBe(true);

    await page.goto(`${WIDGET_ORIGIN}/dentdi/reschedule?token=${booking.rescheduleToken}`);
    await expect(page.getByText(/already been cancelled or completed/)).toBeVisible();
  });
});
