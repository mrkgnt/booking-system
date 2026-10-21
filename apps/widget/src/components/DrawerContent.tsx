import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LocaleSwitcher from "@/components/LocaleSwitcher.js";
import { useLocaleSwitcher } from "@/lib/use-locale-switcher.js";
import type { TenantInfo } from "@/lib/api/tenant-info.js";

type Props = {
  tenantInfo: TenantInfo | null;
  // apiBaseUrl/tenantSlug/initialLocale: known server-side in drawer.astro
  // already (same values it used for its own SSR fetch) and threaded down
  // as plain props so the locale switcher's client-side re-fetch (issue
  // #13) can hit the same apps/api endpoint without needing a PUBLIC_-
  // prefixed env var baked into the client bundle.
  apiBaseUrl: string;
  tenantSlug: string;
  initialLocale: string;
};

// This ticket's drawer content is read-only display (tenant name + catalog)
// — the actual service→availability→contact→confirm booking flow is later
// tickets' scope (#10+). `tenantInfo === null` means the live fetch failed
// (invalid tenant slug or an apps/api outage); issue #11 owns the polished
// "temporarily unavailable" UX, so this intentionally stays minimal rather
// than guessing at that design now.
export default function DrawerContent({ tenantInfo, apiBaseUrl, tenantSlug, initialLocale }: Props) {
  if (!tenantInfo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">Booking is temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <DrawerContentLoaded
      initialTenantInfo={tenantInfo}
      apiBaseUrl={apiBaseUrl}
      tenantSlug={tenantSlug}
      initialLocale={initialLocale}
    />
  );
}

// Split out from the `tenantInfo === null` early return above so
// useLocaleSwitcher (which needs a non-null initial TenantInfo) can be
// called unconditionally here, keeping it a plain top-level hook call
// rather than juggling conditional-hook-call rules in the parent.
function DrawerContentLoaded({
  initialTenantInfo,
  apiBaseUrl,
  tenantSlug,
  initialLocale,
}: {
  initialTenantInfo: TenantInfo;
  apiBaseUrl: string;
  tenantSlug: string;
  initialLocale: string;
}) {
  const { tenantInfo, activeLocale, isSwitching, switchLocale } = useLocaleSwitcher({
    apiBaseUrl,
    tenantSlug,
    initialTenantInfo,
    initialLocale,
  });

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{tenantInfo.tenant.name}</h1>
        <LocaleSwitcher
          supportedLocales={tenantInfo.tenant.supportedLocales}
          activeLocale={activeLocale}
          onLocaleChange={switchLocale}
          disabled={isSwitching}
        />
      </header>

      <div className="flex flex-1 flex-col gap-3">
        {tenantInfo.services.map((service) => (
          <Card key={service.id}>
            <CardHeader>
              <CardTitle className="text-base">{service.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{service.durationMinutes} min</CardContent>
          </Card>
        ))}
      </div>

      <footer className="pt-2 text-center text-xs text-muted-foreground">Powered by [Platform]</footer>
    </div>
  );
}
