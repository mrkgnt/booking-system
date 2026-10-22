import { expect, test } from "@playwright/test";
import { createConfirmedTestBooking, WIDGET_ORIGIN } from "./helpers.js";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";

// Cancel via the Drawer (issue #17) — a standalone top-level page (no
// iframe), reached directly from the cancellation link in a confirmation
// email. Same "doesn't depend on business_profile.status, so this is a
// real, unconditional E2E test against live data" situation as #16's
// reschedule.spec.ts — see that file's header comment and
// helpers.ts's createConfirmedTestBooking for the full rationale,
// including the known shared-rate-limit-bucket flakiness source when run
// alongside other booking-creating specs in the same process.
test.describe("Cancel via the Drawer (issue #17)", () => {
  test("shows the existing booking, confirming cancellation succeeds", async ({ page }) => {
    const booking = await createConfirmedTestBooking(API_BASE_URL);

    await page.goto(`${WIDGET_ORIGIN}/dentdi/cancel?token=${booking.cancelToken}`);

    await expect(page.getByRole("heading", { name: "Cancel your appointment" })).toBeVisible();
    await expect(page.getByText(new Date(booking.startsAt).getFullYear().toString())).toBeVisible();

    await page.getByRole("button", { name: "Cancel this appointment" }).click();
    await expect(page.getByRole("heading", { name: "Cancel your appointment?" })).toBeVisible();

    // "No, keep it" backs out without cancelling — verified via a second
    // lookup rather than just trusting the UI state.
    await page.getByRole("button", { name: "No, keep it" }).click();
    await expect(page.getByRole("heading", { name: "Cancel your appointment" })).toBeVisible();
    const stillActiveRes = await fetch(
      `${API_BASE_URL}/public/bookings/lookup?token=${booking.cancelToken}`,
      { headers: { "X-Tenant-Slug": "dentdi" } },
    );
    const stillActiveBody = await stillActiveRes.json();
    expect(stillActiveBody.booking.status).not.toBe("cancelled");

    await page.getByRole("button", { name: "Cancel this appointment" }).click();
    await page.getByRole("button", { name: "Yes, cancel it" }).click();

    await expect(page.getByRole("heading", { name: "Booking cancelled" })).toBeVisible();

    const lookupRes = await fetch(`${API_BASE_URL}/public/bookings/lookup?token=${booking.cancelToken}`, {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    const lookupBody = await lookupRes.json();
    expect(lookupBody.booking.status).toBe("cancelled");
  });

  test("an invalid token shows a clear error instead of a broken page", async ({ page }) => {
    await page.goto(`${WIDGET_ORIGIN}/dentdi/cancel?token=not-a-real-token-value`);
    await expect(page.getByText(/cancellation link is invalid or has expired/)).toBeVisible();
  });

  test("a missing token shows the same clear error", async ({ page }) => {
    await page.goto(`${WIDGET_ORIGIN}/dentdi/cancel`);
    await expect(page.getByText(/cancellation link is invalid or has expired/)).toBeVisible();
  });

  test("an already-cancelled booking shows an already-actioned state, not a duplicate-cancel button", async ({
    page,
  }) => {
    const booking = await createConfirmedTestBooking(API_BASE_URL);
    const cancelRes = await fetch(`${API_BASE_URL}/bookings/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": "dentdi" },
      body: JSON.stringify({ token: booking.cancelToken }),
    });
    expect(cancelRes.ok).toBe(true);

    await page.goto(`${WIDGET_ORIGIN}/dentdi/cancel?token=${booking.cancelToken}`);
    await expect(page.getByText("This booking has already been cancelled.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel this appointment" })).toHaveCount(0);
  });
});
