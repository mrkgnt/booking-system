import { expect, test } from "@playwright/test";
import { closeHostFixtureServer, hostFixtureUrl } from "./helpers.js";

// Exercises the real embed.js against a static host-page fixture that
// stands in for an arbitrary third-party Tenant site — no mocks, same
// "no mocked backend" philosophy as apps/admin/e2e. Assumes apps/api and
// apps/widget are already running locally (see CLAUDE.md / this app's
// README for launch commands) against the real live Dent Di project.
//
// The fixture is served over real http:// by a tiny local static server
// (e2e/helpers.ts), not file:// — the drawer route's
// `Content-Security-Policy: frame-ancestors *` only matches network-scheme
// ancestors per the CSP spec, so a file:// parent would be blocked from
// framing it at all, which isn't representative of a real Tenant site
// (always http/https) anyway.

test.describe("Booking Widget embed script", () => {
  test.afterAll(async () => {
    await closeHostFixtureServer();
  });

  test("renders the trigger immediately with no network call, before any click", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => requests.push(req.url()));

    await page.goto(await hostFixtureUrl());

    const trigger = page.locator("#platform-widget-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveText("Book Now");

    // embed.js itself, plus the host page document load, are the only two
    // requests the page makes before any click — nothing beyond that (no
    // tenant-info fetch, no iframe) happens before the trigger is clicked.
    const nonPageRequests = requests.filter((url) => !url.endsWith("/embed.js") && !url.endsWith("/host.html"));
    expect(nonPageRequests).toEqual([]);

    // The iframe must not exist in the DOM at all yet.
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("first click creates the iframe and opens the drawer over a backdrop", async ({ page }) => {
    await page.goto(await hostFixtureUrl());

    await expect(page.locator("iframe")).toHaveCount(0);

    await page.locator("#platform-widget-trigger").click();

    // The iframe now exists, targeting the drawer route with the tenant
    // slug threaded through as a query param (?tenant=dentdi — this
    // ticket's chosen shape, see public/embed.js's buildDrawerSrc).
    const iframe = page.locator("iframe");
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute("src", /\/drawer\?tenant=dentdi/);

    await expect(page.locator("#platform-widget-backdrop")).toHaveClass(/pw-open/);
    await expect(page.locator("#platform-widget-drawer")).toHaveClass(/pw-open/);

    // The spinner embed.js shows while the iframe's own content loads
    // disappears once the real iframe.onload fires — proving the loading
    // state is wired to a real signal, not just shown statically.
    await expect(page.locator("#platform-widget-spinner")).toHaveCSS("display", "none");
  });

  test("the drawer's live content fetch resolves without crashing, against the real apps/api + Dent Di project", async ({
    page,
  }) => {
    await page.goto(await hostFixtureUrl());
    await page.locator("#platform-widget-trigger").click();

    const frame = page.frameLocator("iframe");

    // NOTE on what this currently asserts, and why: the live Dent Di
    // business_profile.status in this project is "onboarding", not
    // "active" (confirmed directly against the live Supabase project
    // while building this ticket) — GET /public/tenant-info's own,
    // pre-existing (not this ticket's) "inactive tenant" gate (issue #7)
    // therefore 404s for the real "dentdi" slug today, independent of
    // anything in apps/widget. That's a real fact about this live
    // project's current state, not a bug in the embedding mechanism this
    // ticket builds — flipping that flag is a business-readiness decision
    // outside this ticket's scope, not something to silently change here.
    //
    // So this test asserts the one thing that's actually deterministic
    // right now: a failed live fetch resolves to the documented minimal
    // fallback rather than a crashed/blank iframe (per issue #9's "don't
    // let a fetch failure crash" requirement). Once Dent Di's status
    // flips to "active", replace this assertion with the full happy-path
    // check: the tenant's real name ("Dent Di") and at least one real
    // service name/duration rendered inside the drawer.
    await expect(frame.getByText("Booking is temporarily unavailable.")).toBeVisible();
  });
});
