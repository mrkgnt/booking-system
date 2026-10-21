import http from "node:http";

// Stands in for `GET /public/tenant-info` on the real apps/api, scoped
// to exactly this ticket's own E2E spec (e2e/locale-switcher.spec.ts).
//
// Why a stub at all, rather than the real live Dent Di project (the "no
// mocked backend" rule the rest of apps/widget/e2e follows): the live
// Dent Di business_profile.status is currently "onboarding", not "active"
// — GET /public/tenant-info's own pre-existing gate (issue #7) 404s for
// the real "dentdi" slug regardless of locale (confirmed directly against
// the live project while building this ticket; also independently visible
// in e2e/embed.spec.ts's own documented workaround for the same fact).
// Since that 404 happens before locale is ever considered, there is no
// live Tenant today whose drawer ever reaches the locale-switcher branch
// at all — this is the "mock that one specific response at the test seam"
// case issue #13 itself anticipated, not a second live Tenant Supabase
// project (which would be real over-engineering for one UI control).
//
// Two canned Tenants, selected by the X-Tenant-Slug header exactly like
// the real contract:
//  - "multi-locale-tenant": supportedLocales en/lv/ru — switcher must show.
//  - "single-locale-tenant": supportedLocales en only — switcher must not.
// The returned tenant name varies by `?locale=` so a locale switch is
// independently verifiable as having actually changed the visible copy.
const TENANT_NAMES: Record<string, Record<string, string>> = {
  "multi-locale-tenant": { en: "Multi Locale Clinic (EN)", lv: "Multi Locale Clinic (LV)", ru: "Multi Locale Clinic (RU)" },
  "single-locale-tenant": { en: "Single Locale Clinic (EN)" },
};
const SUPPORTED_LOCALES: Record<string, string[]> = {
  "multi-locale-tenant": ["en", "lv", "ru"],
  "single-locale-tenant": ["en"],
};

let server: http.Server | null = null;
let port: number | null = null;

export function startTenantInfoStubServer(): Promise<number> {
  if (server && port !== null) return Promise.resolve(port);
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      // Mirrors apps/api/src/app.ts's real wide-open CORS on /public/* —
      // origin "*", GET/OPTIONS only, X-Tenant-Slug the one allowed header
      // (see that file's own comment: the embedding origin is an unknown
      // third-party Tenant site, same reasoning applies to this stub since
      // it's standing in for that exact route's contract). Without this, a
      // real browser's client-side locale-switch fetch (the thing this
      // whole stub exists to let this spec exercise) is silently blocked
      // by the browser's CORS preflight — caught the hard way via a
      // console-error capture when this was first missing.
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "X-Tenant-Slug");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", "http://localhost");
      const slug = req.headers["x-tenant-slug"] as string | undefined;

      if (url.pathname !== "/public/tenant-info" || !slug || !TENANT_NAMES[slug]) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "tenant_inactive" }));
        return;
      }

      const defaultLocale = "en";
      const locale = url.searchParams.get("locale") ?? defaultLocale;
      const names = TENANT_NAMES[slug];
      const name = names[locale] ?? names[defaultLocale];

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          tenant: {
            name,
            themeTokens: null,
            defaultLocale,
            supportedLocales: SUPPORTED_LOCALES[slug],
          },
          serviceCategories: [],
          services: [],
          staff: [],
          staffServices: [],
        }),
      );
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to determine tenant-info stub server port"));
        return;
      }
      port = address.port;
      resolve(port);
    });
  });
}

export function stubServerBaseUrl(): string {
  if (port === null) throw new Error("startTenantInfoStubServer() must be awaited first");
  return `http://127.0.0.1:${port}`;
}

export function closeTenantInfoStubServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
    server = null;
    port = null;
  });
}
