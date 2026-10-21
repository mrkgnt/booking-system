import { Button } from "@/components/ui/button";
import type { AvailabilitySlot } from "@/lib/api/booking.js";

type Props = {
  slot: AvailabilitySlot;
  onRestart: () => void;
};

// Step 5 of the booking flow (issue #14): the final success screen once
// POST /bookings/confirm has succeeded. onRestart lets the customer book a
// second appointment in the same drawer session (RESTART in flow-state.ts)
// — the widget is lazy-mounted once per host-page session (ADR-0004), so
// without this the only way back to the service step would be reloading
// the whole host page.
export default function ConfirmedStep({ slot, onRestart }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-base font-semibold">Booking confirmed</h2>
      <p className="text-sm text-muted-foreground">
        See you on{" "}
        {new Date(slot.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
      </p>
      <Button type="button" variant="outline" onClick={onRestart}>
        Book another appointment
      </Button>
    </div>
  );
}
