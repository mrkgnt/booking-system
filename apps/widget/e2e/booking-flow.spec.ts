import { expect, test, type FrameLocator } from "@playwright/test";
import { closeHostFixtureServer, hostFixtureUrl } from "./helpers.js";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";

// Finds a day, within the Calendar's currently-displayed month, that has at
// least one open slot, clicks the first slot button, and returns. Searches
// forward from today (day 0) rather than assuming any specific date is
// open — business hours/closures/existing bookings against the live Dent
// Di project can make any given day empty. Capped at the current month
// view (no "next month" navigation) — a run right at month-end that needs
// to spill into the next month is a known, accepted gap (same spirit as
// this app's other documented near-midnight/date-boundary debt), not
// handled here.
async function pickFirstAvailableSlot(frame: FrameLocator): Promise<void> {
  const today = new Date();
  for (let offset = 0; offset < 28; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`;

    const dayCell = frame.locator(`[data-day="${dateKey}"]:not([data-disabled="true"]) button`);
    if ((await dayCell.count()) === 0) continue; // outside the visible month grid, or disabled (past)

    await dayCell.click();
    // Wait for this date's GET /availability round-trip to settle: either
    // the "no slots" copy or at least one slot button appears.
    const slotButton = frame.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
    const noSlots = frame.getByText("No available times on this date.");
    await Promise.race([slotButton.waitFor({ timeout: 5000 }), noSlots.waitFor({ timeout: 5000 })]).catch(() => {
      // Neither appeared within 5s on this particular day — treat as no
      // slots and move on rather than hanging the whole search.
    });
    if (await slotButton.count()) {
      await slotButton.click();
      return;
    }
  }
  throw new Error("No available slot found in the next 28 days against the live project — can't proceed");
}

test.describe("Full booking flow through the Drawer (issue #14)", () => {
  test.beforeAll(async () => {
    // The live "dentdi" tenant's business_profile.status is "onboarding",
    // not "active", as of this ticket (confirmed directly against the
    // live Supabase project, 2026-10-21) — GET /public/tenant-info's own,
    // pre-existing (issue #7's, not this ticket's) "inactive tenant" gate
    // therefore 404s for "dentdi" today, which means drawer.astro's SSR
    // fetch always resolves tenantInfo to null and DrawerContent only ever
    // renders the generic "Booking is temporarily unavailable." fallback —
    // nothing below this point in the real flow is reachable through the
    // embedded drawer while that stays true. See embed.spec.ts's own
    // comment on the same fact, and CLAUDE.md. The underlying
    // GET /availability -> POST /bookings -> POST /bookings/confirm chain
    // was separately verified correct via direct fetch/curl against the
    // live project while this spec was written (status pending_verification
    // -> confirmed, exactly as expected) — this is a live-tenant-readiness
    // gap, not a defect in the Drawer's booking flow.
    //
    // This check is live and dynamic, not a hardcoded assumption, so this
    // suite starts exercising the real flow automatically the moment the
    // tenant flips to "active" — no code change needed here.
    const res = await fetch(`${API_BASE_URL}/public/tenant-info`, { headers: { "X-Tenant-Slug": "dentdi" } });
    test.skip(
      !res.ok,
      `live "dentdi" tenant isn't "active" yet (GET /public/tenant-info -> ${res.status}) — see CLAUDE.md`,
    );
  });

  test.afterAll(async () => {
    await closeHostFixtureServer();
  });

  test("service -> availability -> contact -> confirm completes a real booking end-to-end", async ({ page }) => {
    await page.goto(await hostFixtureUrl());
    await page.locator("#platform-widget-trigger").click();

    const frame = page.frameLocator("iframe");

    await frame.getByRole("heading", { name: "Choose a service" }).waitFor();
    await frame.getByRole("button", { name: "Continue" }).click();

    await frame.getByRole("heading", { name: "Pick a time" }).waitFor();
    await pickFirstAvailableSlot(frame);

    await frame.getByRole("heading", { name: "Your details" }).waitFor();
    await frame.getByLabel("Name").fill("Widget E2E Test");
    await frame.getByLabel("Email").fill(`widget-e2e-${Date.now()}@example.com`);
    await frame.getByLabel(/I agree to be contacted/).click();
    await frame.getByRole("button", { name: "Book appointment" }).click();

    await frame.getByRole("heading", { name: "Almost done" }).waitFor();
    // Notification delivery is stubbed project-wide (see CLAUDE.md) — this
    // dev-only button is how a real browser session (and this spec)
    // completes the double opt-in without a real inbox, same mechanism
    // ConfirmPendingStep.tsx documents.
    await frame.getByRole("button", { name: /Dev: confirm now/ }).click();

    await expect(frame.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  });

  // The "slot taken by someone else while filling in contact info" bounce-
  // back (story #6-13 / flow-state.ts's SLOT_TAKEN transition) is covered
  // by flow-state.test.ts's deterministic unit test, not a second E2E case
  // here — reliably racing a real steal against this suite's shared live
  // "dentdi" data from outside the page (without a stable handle on which
  // exact slot the UI just selected) risks corrupting an unrelated slot
  // for no real additional coverage over the reducer test.
});
