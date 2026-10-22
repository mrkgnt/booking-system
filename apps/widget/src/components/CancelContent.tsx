import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cancelBooking } from "@/lib/api/booking.js";
import type { BookingLookup } from "@/lib/api/booking-lookup.js";

// Static UI copy here stays plain English, same as RescheduleContent.tsx
// (issue #16) and the booking-flow components (issue #14) — none of those
// localize via messages.ts either.
type Props = {
  booking: BookingLookup;
  token: string;
  tenantSlug: string;
  apiBaseUrl: string;
};

type ViewState =
  | { step: "viewing" }
  | { step: "confirming" }
  | { step: "submitting" }
  | { step: "cancelled" }
  | { step: "error"; message: string };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Issue #17 — cancel via the Drawer, as a standalone top-level page (no
// iframe, reached directly from the cancellation link in a confirmation
// email) rather than embedded, same shared visual shell as #16's
// reschedule page. No availability-picker to reuse here (unlike
// reschedule) — just the booking's details and a confirm step, so an
// accidental tap on the cancellation link (or a confirmation email opened
// by mistake) doesn't cancel the appointment with a single click.
export default function CancelContent({ booking, token, tenantSlug, apiBaseUrl }: Props) {
  const [view, setView] = useState<ViewState>({ step: "viewing" });

  async function handleConfirmCancel() {
    setView({ step: "submitting" });
    const result = await cancelBooking(apiBaseUrl, tenantSlug, token);
    if (result.ok) {
      setView({ step: "cancelled" });
      return;
    }
    setView({ step: "error", message: "Something went wrong — please try again." });
  }

  if (view.step === "cancelled") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-base font-semibold">Booking cancelled</h1>
        <p className="text-sm text-muted-foreground">
          Your appointment on {formatDateTime(booking.startsAt)} has been cancelled.
        </p>
      </div>
    );
  }

  if (view.step === "confirming" || view.step === "submitting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-base font-semibold">Cancel your appointment?</h1>
        <p className="text-sm text-muted-foreground">
          {booking.service.name} — {formatDateTime(booking.startsAt)}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={view.step === "submitting"}
            onClick={handleConfirmCancel}
          >
            Yes, cancel it
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={view.step === "submitting"}
            onClick={() => setView({ step: "viewing" })}
          >
            No, keep it
          </Button>
        </div>
        {view.step === "submitting" && <p className="text-sm text-muted-foreground">Cancelling…</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Cancel your appointment</h1>
      <div className="rounded-md border border-border p-3">
        <p className="font-medium">{booking.service.name}</p>
        {booking.staff?.name && <p className="text-sm text-muted-foreground">with {booking.staff.name}</p>}
        <p className="text-sm text-muted-foreground">{formatDateTime(booking.startsAt)}</p>
      </div>
      {view.step === "error" && <p className="text-sm text-destructive">{view.message}</p>}
      <Button type="button" variant="destructive" onClick={() => setView({ step: "confirming" })}>
        Cancel this appointment
      </Button>
      <footer className="pt-2 text-center text-xs text-muted-foreground">Powered by [Platform]</footer>
    </div>
  );
}
