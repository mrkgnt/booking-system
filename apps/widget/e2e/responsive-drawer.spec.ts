import { expect, test } from "@playwright/test";
import { closeHostFixtureServer, hostFixtureUrl } from "./helpers.js";

// Issue #12 — mobile full-screen layout. Verifies the drawer's actual
// rendered geometry/computed style at two concrete viewport sizes, not just
// that a class name is present — per the issue's explicit "verified via
// viewport-size emulation... not just manual resize" acceptance criterion.
//
// Breakpoint: 768px, chosen to match Tailwind's own `md` breakpoint
// (min-width: 768px) already in use elsewhere in this app's stack (see
// components.json / tailwind config) — "mobile" here means anything below
// that, consistent with how the rest of the codebase defines the cutoff.
// Test viewports are picked well clear of the boundary on both sides
// (375px mobile, 1280px desktop) so the assertions aren't sensitive to
// off-by-one rounding right at 768px.

test.describe("Booking Widget drawer — responsive layout (issue #12)", () => {
  test.afterAll(async () => {
    await closeHostFixtureServer();
  });

  test("below the mobile breakpoint, the drawer is a full-screen takeover with no visible backdrop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(await hostFixtureUrl());
    await page.locator("#platform-widget-trigger").click();

    const drawer = page.locator("#platform-widget-drawer");
    await expect(drawer).toHaveClass(/pw-open/);

    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    // Full viewport coverage, not a side panel.
    expect(box!.x).toBe(0);
    expect(box!.width).toBe(375);
    expect(box!.height).toBe(812);

    // The backdrop must not visibly dim the (nonexistent, off-screen)
    // page behind it at this size — asserted via its actual computed
    // style, not just absence of a class.
    const backdropOpacity = await page.locator("#platform-widget-backdrop").evaluate((el) => getComputedStyle(el).opacity);
    expect(backdropOpacity).toBe("0");
  });

  test("at or above the mobile breakpoint, the drawer keeps the ~35vw side-panel + dimmed backdrop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(await hostFixtureUrl());
    await page.locator("#platform-widget-trigger").click();

    const drawer = page.locator("#platform-widget-drawer");
    await expect(drawer).toHaveClass(/pw-open/);

    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    // ~35vw side panel pinned to the right edge, not full-screen.
    const expectedWidth = 1280 * 0.35;
    expect(box!.width).toBeGreaterThan(expectedWidth - 5);
    expect(box!.width).toBeLessThan(expectedWidth + 5);
    expect(box!.x).toBeGreaterThan(0);

    const backdropOpacity = await page.locator("#platform-widget-backdrop").evaluate((el) => getComputedStyle(el).opacity);
    expect(backdropOpacity).toBe("1");
  });
});
