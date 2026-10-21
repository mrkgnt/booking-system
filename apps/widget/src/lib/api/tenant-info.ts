// Shape of GET /public/tenant-info's response (apps/api/src/routes/tenant-info.ts).
// Kept intentionally loose/duplicated here rather than importing apps/api's
// types — apps/widget is self-contained, no shared packages (ADR-0004).
export type TenantInfo = {
  tenant: {
    name: string;
    themeTokens: unknown;
    defaultLocale: string;
    supportedLocales: string[];
  };
  serviceCategories: Array<{ id: string; icon: string | null; displayOrder: number; name: string }>;
  services: Array<{
    id: string;
    categoryId: string | null;
    durationMinutes: number;
    bufferMinutesBefore: number;
    bufferMinutesAfter: number;
    priceAmount: number | null;
    priceCurrency: string;
    pricePrefix: string;
    displayOrder: number;
    name: string;
    description: string;
  }>;
  staff: Array<{ id: string; name: string; photoUrl: string | null; displayOrder: number; bio: string }>;
  staffServices: Array<{ staffId: string; serviceId: string }>;
};

// Pure URL-builder — the actual non-DOM logic worth a vitest seam on its
// own (the fetch call itself is exercised live via Playwright E2E against
// the real Dent Di project, per this ticket's testing decisions).
export function buildTenantInfoUrl(apiBaseUrl: string, locale?: string): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = `${base}/public/tenant-info`;
  return locale ? `${url}?locale=${encodeURIComponent(locale)}` : url;
}

// Server-side fetch used by src/pages/drawer.astro. Never throws — a
// failed/non-2xx fetch (invalid tenant slug, apps/api outage, etc.) is
// logged via console.error and surfaced to the caller as `null`, so the
// drawer route can render a minimal fallback instead of crashing the SSR
// render (issue #11's polished "unavailable" UX is explicitly out of scope
// for this ticket — just don't let a fetch failure take the page down).
export async function fetchTenantInfo(
  apiBaseUrl: string,
  tenantSlug: string,
  locale?: string,
): Promise<TenantInfo | null> {
  try {
    const res = await fetch(buildTenantInfoUrl(apiBaseUrl, locale), {
      headers: { "X-Tenant-Slug": tenantSlug },
    });
    if (!res.ok) {
      console.error(`[widget] GET /public/tenant-info failed for tenant "${tenantSlug}": ${res.status}`);
      return null;
    }
    return (await res.json()) as TenantInfo;
  } catch (err) {
    console.error(`[widget] GET /public/tenant-info errored for tenant "${tenantSlug}":`, err);
    return null;
  }
}
