import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DrawerContent from "../../src/components/DrawerContent.js";
import type { TenantInfo } from "../../src/lib/api/tenant-info.js";

// Regression coverage for: on mobile, the drawer's full-screen takeover has
// no backdrop to tap (public/embed.js zeroes out the backdrop's dimming/
// click-to-close below its mobile breakpoint), so the in-content close
// button (CloseButton.tsx, wired to close-widget.ts's postMessage) is the
// only way to dismiss it there. It must render in every DrawerContent
// branch, not just the loaded happy path — the "unavailable" failure state
// previously had no header/close affordance at all.

function makeTenantInfo(): TenantInfo {
  return {
    tenant: { name: "Some Clinic", themeTokens: null, defaultLocale: "en", supportedLocales: ["en"] },
    serviceCategories: [],
    services: [],
    staff: [],
    staffServices: [],
  };
}

const commonProps = { apiBaseUrl: "http://api.example.com", tenantSlug: "dentdi", locale: "en" };

describe("DrawerContent's close button", () => {
  it("renders a close button in the loaded header", () => {
    const markup = renderToStaticMarkup(<DrawerContent tenantInfo={makeTenantInfo()} {...commonProps} />);
    expect(markup).toContain('aria-label="Close"');
  });

  it("renders a close button even when tenantInfo failed to load (the unavailable state)", () => {
    const markup = renderToStaticMarkup(<DrawerContent tenantInfo={null} {...commonProps} />);
    expect(markup).toContain('aria-label="Close"');
  });

  it("localizes the close button's label", () => {
    const markup = renderToStaticMarkup(
      <DrawerContent tenantInfo={null} {...commonProps} locale="lv" />,
    );
    expect(markup).toContain('aria-label="Aizvērt"');
  });
});
