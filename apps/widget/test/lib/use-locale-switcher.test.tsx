// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocaleSwitcher } from "../../src/lib/use-locale-switcher.js";
import type { TenantInfo } from "../../src/lib/api/tenant-info.js";

// jsdom only (not full Playwright) — this is the hook's own state/fetch
// logic in isolation from the Radix/shadcn Select markup it drives.
// Radix's interactive dropdown needs a real browser (pointer capture,
// portals) and is exercised there instead (apps/widget/e2e); this seam
// instead proves: switching locale re-fetches via the right URL/headers,
// updates the visible tenantInfo, never touches window.location, and
// fails soft (keeps the old locale) when the re-fetch comes back null.

function makeTenantInfo(name: string, supportedLocales: string[]): TenantInfo {
  return {
    tenant: { name, themeTokens: null, defaultLocale: "en", supportedLocales },
    serviceCategories: [],
    services: [],
    staff: [],
    staffServices: [],
  };
}

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useLocaleSwitcher> | null = null;

function Harness(props: Parameters<typeof useLocaleSwitcher>[0]) {
  latest = useLocaleSwitcher(props);
  return null;
}

function renderHarness(props: Parameters<typeof useLocaleSwitcher>[0]) {
  act(() => {
    root.render(<Harness {...props} />);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
  latest = null;
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  vi.unstubAllGlobals();
});

describe("useLocaleSwitcher", () => {
  it("starts with the initial tenantInfo/locale and not switching", () => {
    const initial = makeTenantInfo("Multi Locale Clinic", ["en", "lv", "ru"]);
    renderHarness({ apiBaseUrl: "http://api.example.com", tenantSlug: "dentdi", initialTenantInfo: initial, initialLocale: "en" });

    expect(latest?.tenantInfo).toBe(initial);
    expect(latest?.activeLocale).toBe("en");
    expect(latest?.isSwitching).toBe(false);
  });

  it("re-fetches tenant-info for the new locale and updates visible copy, without reloading the page", async () => {
    const initial = makeTenantInfo("Multi Locale Clinic", ["en", "lv", "ru"]);
    const switched = makeTenantInfo("Klīnika Multi Locale", ["en", "lv", "ru"]);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => switched,
    });
    vi.stubGlobal("fetch", fetchMock);
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });

    renderHarness({ apiBaseUrl: "http://api.example.com", tenantSlug: "dentdi", initialTenantInfo: initial, initialLocale: "en" });

    await act(async () => {
      latest?.switchLocale("lv");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.example.com/public/tenant-info?locale=lv");
    expect(init.headers["X-Tenant-Slug"]).toBe("dentdi");

    expect(latest?.tenantInfo?.tenant.name).toBe("Klīnika Multi Locale");
    expect(latest?.activeLocale).toBe("lv");
    expect(latest?.isSwitching).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("keeps the current locale/tenantInfo when the re-fetch fails (fail-soft, no crash)", async () => {
    const initial = makeTenantInfo("Multi Locale Clinic", ["en", "lv", "ru"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderHarness({ apiBaseUrl: "http://api.example.com", tenantSlug: "dentdi", initialTenantInfo: initial, initialLocale: "en" });

    await act(async () => {
      latest?.switchLocale("ru");
    });

    expect(latest?.tenantInfo).toBe(initial);
    expect(latest?.activeLocale).toBe("en");
    expect(latest?.isSwitching).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});
