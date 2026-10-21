import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TenantInfo } from "@/lib/api/tenant-info.js";
import { getMessage } from "@/lib/i18n/messages.js";

type Props = {
  tenantInfo: TenantInfo | null;
  // The locale resolved from the embed's data-locale attribute (threaded
  // through the iframe's ?locale= query param — see drawer.astro). Used
  // only for the unavailable-message fallback below: when tenantInfo is
  // null there's no tenant default locale to fall back to (that data is
  // itself part of what failed to load), so this is the one signal left.
  locale?: string | null;
};

// This ticket's drawer content is read-only display (tenant name + catalog)
// — the actual service→availability→contact→confirm booking flow is later
// tickets' scope (#10+). `tenantInfo === null` means the live fetch failed
// — invalid/inactive tenant slug OR an apps/api outage, both converging on
// the same generic, locale-aware message here (issue #11): no tenant-
// specific contact info, since that data is itself part of what failed to
// load. The underlying cause is still distinguishable server-side via
// fetchTenantInfo's console.error calls (src/lib/api/tenant-info.ts).
export default function DrawerContent({ tenantInfo, locale }: Props) {
  if (!tenantInfo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">{getMessage("unavailable", locale)}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <header>
        <h1 className="text-xl font-semibold">{tenantInfo.tenant.name}</h1>
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
