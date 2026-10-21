import { expect, test } from "@playwright/test";
import {
  closeHostFixtureServer,
  hostFixtureUrl,
  hostUnknownTenantFixtureUrl,
  startWidgetServerWithUnreachableApi,
  stopWidgetServerWithUnreachableApi,
  WIDGET_ORIGIN,
} from "./helpers.js";

// Issue #11 — three distinct causes (genuinely unknown tenant slug, a
// real-but-inactive tenant, and a live apps/api outage) must all converge
// on the IDENTICAL generic, locale-aware "temporarily unavailable"
// message, with no tenant-specific contact info, while the trigger itself
// keeps rendering regardless. The underlying cause stays distinguishable
// via fetchTenantInfo's own console.error calls (src/lib/api/tenant-info.ts)
// — verified manually against each scenario's server-side log output while
// building this suite (a non-2xx response logs the HTTP status + tenant
// slug; a network-level failure logs the raw thrown error/stack), not
// re-asserted here since Playwright has no clean hook into the widget's
// own SSR process stdout from the browser side.

const UNAVAILABLE_MESSAGE_EN = "Booking is temporarily unavailable. Please check back soon.";

test.describe("Booking Widget — unavailable UX (issue #11)", () => {
  test.afterAll(async () => {
    await closeHostFixtureServer();
    await stopWidgetServerWithUnreachableApi();
  });

  test("a genuinely unknown tenant slug: trigger still renders, drawer shows the generic message, no tenant info leaks", async ({
    page,
  }) => {
    await page.goto(await hostUnknownTenantFixtureUrl());

    const trigger = page.locator("#platform-widget-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveText("Book Now");

    await trigger.click();

    const frame = page.frameLocator("iframe");
    await expect(frame.getByText(UNAVAILABLE_MESSAGE_EN, { exact: true })).toBeVisible();

    // No tenant-specific contact fallback of any kind — that data is
    // itself part of what failed to load.
    await expect(frame.getByText("Dent Di")).toHaveCount(0);
    await expect(frame.getByText(/@/)).toHaveCount(0);
  });

  test('the real "dentdi" tenant (business_profile.status="onboarding", not active) shows the IDENTICAL generic message', async ({
    page,
  }) => {
    // Not simulated — dentdi genuinely isn't active in the live Dent Di
    // project right now (confirmed directly against the project while
    // building this ticket; see CLAUDE.md), so GET /public/tenant-info
    // already 404s with tenant_inactive for this real slug. A different
    // failure cause than the unknown-slug test above (unknown tenant vs.
    // a known-but-inactive one), required to converge on the exact same
    // customer-facing text.
    await page.goto(await hostFixtureUrl());
    await page.locator("#platform-widget-trigger").click();

    const frame = page.frameLocator("iframe");
    await expect(frame.getByText(UNAVAILABLE_MESSAGE_EN, { exact: true })).toBeVisible();
    await expect(frame.getByText("Dent Di")).toHaveCount(0);
    await expect(frame.getByText(/@/)).toHaveCount(0);
  });

  test("a live content-fetch failure (apps/api unreachable) shows the IDENTICAL generic message", async ({
    page,
  }) => {
    // A third, genuinely distinct cause: not an invalid/inactive tenant at
    // all, but apps/api itself being unreachable. Navigates straight to
    // the drawer route served by a second apps/widget instance whose
    // API_BASE_URL points at a port nothing listens on — the
    // trigger/lazy-iframe mechanism itself is already covered by
    // embed.spec.ts, so this test is purely about the drawer's own
    // content-fetch-failure path landing on the same message as the two
    // tenant-validity cases above.
    const badApiOrigin = await startWidgetServerWithUnreachableApi();

    await page.goto(`${badApiOrigin}/drawer?tenant=dentdi&locale=en`);

    await expect(page.getByText(UNAVAILABLE_MESSAGE_EN, { exact: true })).toBeVisible();
    await expect(page.getByText("Dent Di")).toHaveCount(0);
    await expect(page.getByText(/@/)).toHaveCount(0);
  });

  test("the unavailable message is locale-aware end-to-end through the real drawer route", async ({ page }) => {
    // The pure lookup/fallback logic already has its own vitest seam
    // (test/lib/i18n/messages.test.ts); this proves the real drawer route
    // actually threads ?locale= through to it. Navigates straight to the
    // drawer with ?locale=lv — the exact shape embed.js's buildDrawerSrc
    // produces for a data-locale="lv" script tag (see
    // test/embed/embed.test.ts), so this is equivalent to going through
    // the full embed/trigger/iframe path without needing a third fixture
    // file just to vary one query param.
    await page.goto(`${WIDGET_ORIGIN}/drawer?tenant=nonexistent-tenant-xyz&locale=lv`);

    await expect(
      page.getByText("Rezervēšana īslaicīgi nav pieejama. Lūdzu, mēģiniet vēlāk.", { exact: true }),
    ).toBeVisible();
  });
});
