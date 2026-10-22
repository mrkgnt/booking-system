import { test, expect } from "@playwright/test";
import { skipIfNoCreds } from "./helpers.js";

// Second half of issue #27's acceptance criteria: proves the price-list
// search/filter (ticket #24, apps/site/src/components/PriceList.tsx) genuinely
// narrows the rendered results on the live /prices page — not just that the
// component renders a static list. Doesn't need admin credentials itself
// (it's a read-only check of apps/site alone), but test.skip's the same way
// as the roundtrip spec for consistency with this repo's "skip cleanly when
// credentials are unset" E2E convention, since this suite is meant to be run
// as a whole against live data with those credentials present.
test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("the price-list search box narrows the visible services on /prices", async ({ page }) => {
  await page.goto("/prices");

  // Scoped to <main> — Footer.astro (sitewide chrome, rendered outside
  // <main>, see SiteLayout.astro) also has its own unrelated <li> rows
  // (the business-hours list), which would otherwise inflate/pollute this
  // count.
  const serviceRows = page.locator("main li");
  const initialCount = await serviceRows.count();
  expect(initialCount).toBeGreaterThan(0);

  // Pick a real, specific search term from the first visible service's own
  // name rather than a hardcoded guess — keeps this spec correct regardless
  // of which real catalog data is seeded live (ticket #26 replaced the
  // Faker placeholders with Dent Di's real services).
  const firstServiceText = (await serviceRows.first().locator("span").first().textContent())?.trim() ?? "";
  expect(firstServiceText.length).toBeGreaterThan(0);
  const searchTerm = firstServiceText.slice(0, Math.max(3, Math.floor(firstServiceText.length / 2)));

  const searchBox = page.getByRole("searchbox");
  await expect(searchBox).toBeVisible();
  await searchBox.fill(searchTerm);

  // The filtered list must actually be narrower than the full catalog, and
  // every remaining visible row's text must match the typed term — proving
  // the box filters, rather than merely accepting input with no effect.
  await expect(async () => {
    const filteredCount = await serviceRows.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);
  }).toPass();

  const remainingTexts = await serviceRows.allTextContents();
  for (const text of remainingTexts) {
    expect(text.toLowerCase()).toContain(searchTerm.toLowerCase());
  }

  // Clear the search — the full, unfiltered catalog comes back.
  await searchBox.fill("");
  await expect(async () => {
    expect(await serviceRows.count()).toBe(initialCount);
  }).toPass();

  // A search term matching nothing shows the "no results" state, not an
  // empty but still-"matching" list.
  await searchBox.fill("zzzzznonexistentservicezzzzz");
  await expect(serviceRows).toHaveCount(0);
});
