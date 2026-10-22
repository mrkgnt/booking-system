import { useState } from "react";
import { Button } from "@/components/ui/button";
import AvailabilityStep from "@/components/booking/AvailabilityStep";
import type { AvailabilitySlot } from "@/lib/api/booking.js";
import { rescheduleBooking } from "@/lib/api/booking.js";
import type { BookingLookup } from "@/lib/api/booking-lookup.js";

// Static UI copy here stays plain English, same as ServiceStep/
// AvailabilityStep/ContactStep/ConfirmedStep (issue #14) — none of those
// localize via messages.ts either; that's existing, accepted scope, not
// something this ticket expands.
type Props = {
  booking: BookingLookup;
  token: string;
  tenantSlug: string;
  apiBaseUrl: string;
};

type ViewState =
  | { step: "viewing" }
  | { step: "picking" }
  | { step: "submitting"; slot: AvailabilitySlot }
  | { step: "submitted"; slot: AvailabilitySlot }
  | { step: "error"; message: string };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Issue #16 — reschedule via the Drawer, as a standalone top-level page
// (no iframe, reached directly from the reschedule link in a confirmation
// email) rather than embedded. Reuses AvailabilityStep unchanged, the same
// component the main booking flow (issue #14) uses, scoped to the existing
// booking's service AND staff — apps/api's /bookings/reschedule contract
// only accepts a new time, not a new staff member (it re-checks the
// ORIGINAL booking.staff_id's conflicts server-side), so staffOptions is
// deliberately always empty here: AvailabilityStep's own staff Select only
// renders when staffOptions is non-empty, and offering "any staff"/a
// different staff would show slots that don't correspond to what
// /bookings/reschedule actually validates against.
export default function RescheduleContent({ booking, token, tenantSlug, apiBaseUrl }: Props) {
  const [view, setView] = useState<ViewState>({ step: "viewing" });

  async function handleSelectSlot(slot: AvailabilitySlot) {
    setView({ step: "submitting", slot });
    const result = await rescheduleBooking(apiBaseUrl, tenantSlug, { token, newStartsAt: slot.startsAt });
    if (result.ok) {
      setView({ step: "submitted", slot });
      return;
    }
    setView({ step: "error", message: "Something went wrong — please try again." });
  }

  if (view.step === "submitted") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-base font-semibold">Booking rescheduled</h1>
        <p className="text-sm text-muted-foreground">See you on {formatDateTime(view.slot.startsAt)}.</p>
      </div>
    );
  }

  if (view.step === "picking" || view.step === "submitting") {
    return (
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
        <AvailabilityStep
          apiBaseUrl={apiBaseUrl}
          tenantSlug={tenantSlug}
          serviceId={booking.serviceId}
          staffId={booking.staffId}
          staffOptions={[]}
          onSelectStaff={() => {}}
          onSelectSlot={handleSelectSlot}
          onBack={() => setView({ step: "viewing" })}
        />
        {view.step === "submitting" && (
          <p className="text-center text-sm text-muted-foreground">Rescheduling…</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Reschedule your appointment</h1>
      <div className="rounded-md border border-border p-3">
        <p className="font-medium">{booking.service.name}</p>
        {booking.staff?.name && <p className="text-sm text-muted-foreground">with {booking.staff.name}</p>}
        <p className="text-sm text-muted-foreground">Currently: {formatDateTime(booking.startsAt)}</p>
      </div>
      {view.step === "error" && <p className="text-sm text-destructive">{view.message}</p>}
      <Button type="button" onClick={() => setView({ step: "picking" })}>
        Pick a new time
      </Button>
      <footer className="pt-2 text-center text-xs text-muted-foreground">Powered by [Platform]</footer>
    </div>
  );
}
