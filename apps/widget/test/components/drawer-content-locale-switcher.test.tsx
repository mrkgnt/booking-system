import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DrawerContent from "../../src/components/DrawerContent.js";
import type { TenantInfo } from "../../src/lib/api/tenant-info.js";

// Pure, DOM-free seam: renderToStaticMarkup exercises DrawerContent's real
// component tree (incl. the real LocaleSwitcher/shadcn Select trigger
// markup) without needing jsdom or a real browser — sufficient to prove
// presence/absence, which doesn't require opening the dropdown. The
// interactive "select a new locale" behavior is covered separately by
// use-locale-switcher.test.tsx (the hook, in jsdom) and by
// e2e/locale-switcher.spec.ts (the full Radix interaction, in a real
// browser) — see that spec file's header comment for why a real browser
// is needed there.

function makeTenantInfo(supportedLocales: string[]): TenantInfo {
  return {
    tenant: { name: "Some Clinic", themeTokens: null, defaultLocale: "en", supportedLocales },
    serviceCategories: [],
    services: [],
    staff: [],
    staffServices: [],
  };
}

const commonProps = { apiBaseUrl: "http://api.example.com", tenantSlug: "dentdi", initialLocale: "en" };

describe("DrawerContent's locale switcher", () => {
  it("renders the switcher trigger when the tenant supports more than one locale", () => {
    const markup = renderToStaticMarkup(
      <DrawerContent tenantInfo={makeTenantInfo(["en", "lv", "ru"])} {...commonProps} />,
    );
    expect(markup).toContain('data-testid="locale-switcher"');
  });

  it("never renders the switcher for a single-locale tenant", () => {
    const markup = renderToStaticMarkup(<DrawerContent tenantInfo={makeTenantInfo(["en"])} {...commonProps} />);
    expect(markup).not.toContain('data-testid="locale-switcher"');
  });

  it("never renders the switcher when the tenant-info fetch failed (tenantInfo is null)", () => {
    const markup = renderToStaticMarkup(<DrawerContent tenantInfo={null} {...commonProps} />);
    expect(markup).not.toContain('data-testid="locale-switcher"');
  });
});
