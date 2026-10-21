import { useState } from "react";
import { fetchTenantInfo, type TenantInfo } from "./api/tenant-info.js";

// The locale switcher's actual state/fetch logic, split out of the
// switcher's JSX (src/components/LocaleSwitcher.tsx) so it's testable in
// jsdom without needing a real browser to drive shadcn/Radix's
// interactive dropdown (see apps/widget/test/lib/use-locale-switcher.test.tsx
// for why that split matters).
//
// Switching locale re-fetches GET /public/tenant-info?locale=<new> client
// side via the same fetchTenantInfo used for the initial SSR fetch — never
// a full window.location.reload() (issue #13's acceptance criteria). On a
// failed re-fetch (fetchTenantInfo already fails soft and returns null),
// this keeps showing the current locale/tenantInfo rather than blanking
// the drawer — switching locale is a nice-to-have, not worth losing an
// already-successfully-loaded drawer over a transient failure.
export type UseLocaleSwitcherArgs = {
  apiBaseUrl: string;
  tenantSlug: string;
  initialTenantInfo: TenantInfo;
  initialLocale: string;
};

export type UseLocaleSwitcherResult = {
  tenantInfo: TenantInfo;
  activeLocale: string;
  isSwitching: boolean;
  switchLocale: (locale: string) => void;
};

export function useLocaleSwitcher({
  apiBaseUrl,
  tenantSlug,
  initialTenantInfo,
  initialLocale,
}: UseLocaleSwitcherArgs): UseLocaleSwitcherResult {
  const [tenantInfo, setTenantInfo] = useState(initialTenantInfo);
  const [activeLocale, setActiveLocale] = useState(initialLocale);
  const [isSwitching, setIsSwitching] = useState(false);

  function switchLocale(locale: string) {
    if (locale === activeLocale) return;
    setIsSwitching(true);
    void fetchTenantInfo(apiBaseUrl, tenantSlug, locale)
      .then((result) => {
        if (result) {
          setTenantInfo(result);
          setActiveLocale(locale);
        }
        // fetchTenantInfo already console.error'd a failure — nothing
        // further to do here than leave the current locale/content shown.
      })
      .finally(() => setIsSwitching(false));
  }

  return { tenantInfo, activeLocale, isSwitching, switchLocale };
}
