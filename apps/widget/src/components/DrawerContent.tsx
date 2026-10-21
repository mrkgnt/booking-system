import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TenantInfo } from "@/lib/api/tenant-info.js";

type Props = {
  tenantInfo: TenantInfo | null;
};

// This ticket's drawer content is read-only display (tenant name + catalog)
// — the actual service→availability→contact→confirm booking flow is later
// tickets' scope (#10+). `tenantInfo === null` means the live fetch failed
// (invalid tenant slug or an apps/api outage); issue #11 owns the polished
// "temporarily unavailable" UX, so this intentionally stays minimal rather
// than guessing at that design now.
export default function DrawerContent({ tenantInfo }: Props) {
  if (!tenantInfo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">Booking is temporarily unavailable.</p>
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
