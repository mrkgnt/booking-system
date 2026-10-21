import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import type { TenantInfo } from "@/lib/api/tenant-info.js";

type Props = {
  services: TenantInfo["services"];
  onSelect: (serviceId: string) => void;
};

// Step 1 of the booking flow (issue #14): lists services from the
// already-fetched /public/tenant-info catalog data — no new endpoint
// needed for this step, per the ticket's own scope note.
export default function ServiceStep({ services, onSelect }: Props) {
  const [selected, setSelected] = useState<string | undefined>(services[0]?.id);

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">No services are available to book right now.</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="text-base font-semibold">Choose a service</h2>
      <RadioGroup value={selected} onValueChange={setSelected} className="flex-1">
        {services.map((service) => (
          <Label
            key={service.id}
            htmlFor={`service-${service.id}`}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border p-3"
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{service.name}</span>
              <span className="text-xs text-muted-foreground">{service.durationMinutes} min</span>
            </span>
            <RadioGroupItem value={service.id} id={`service-${service.id}`} />
          </Label>
        ))}
      </RadioGroup>
      <Button type="button" disabled={!selected} onClick={() => selected && onSelect(selected)}>
        Continue
      </Button>
    </div>
  );
}
