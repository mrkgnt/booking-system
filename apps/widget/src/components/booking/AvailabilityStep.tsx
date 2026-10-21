import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAvailability, type AvailabilitySlot } from "@/lib/api/booking.js";

type StaffOption = { id: string; name: string };

type Props = {
  apiBaseUrl: string;
  tenantSlug: string;
  serviceId: string;
  staffOptions: StaffOption[];
  staffId?: string;
  notice?: "slot_taken";
  onSelectStaff: (staffId: string | undefined) => void;
  onSelectSlot: (slot: AvailabilitySlot) => void;
  onBack: () => void;
};

// GET /availability's `date` param is calendar-local to the TENANT's own
// business_profile.timezone (see apps/api/src/lib/availability.ts) — but
// /public/tenant-info doesn't expose that timezone to the widget today, so
// there's no value to format against here. We use the visitor's own
// browser-local calendar day instead: correct for the common case (Dent
// Di's visitors are overwhelmingly Latvia/Baltics-local too), with a known
// near-midnight edge case for a visitor in a very different timezone —
// accepted MVP debt, same spirit as timezone.ts's documented DST
// approximation. Revisit by threading timezone through tenant-info if a
// Tenant with a genuinely global customer base ever needs it.
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ANY_STAFF = "__any__";

// Step 2 of the booking flow (issue #14): live availability for the
// service chosen in ServiceStep, via GET /availability — staffId is
// optional ("any eligible staff", matching apps/api's own contract when
// staffId is omitted entirely).
export default function AvailabilityStep({
  apiBaseUrl,
  tenantSlug,
  serviceId,
  staffOptions,
  staffId,
  notice,
  onSelectStaff,
  onSelectSlot,
  onBack,
}: Props) {
  const [date, setDate] = useState<Date>(() => new Date());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateKey = useMemo(() => toDateKey(date), [date]);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAvailability(apiBaseUrl, tenantSlug, { serviceId, date: dateKey, staffId }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setSlots(result.slots);
      } else {
        setSlots([]);
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, tenantSlug, serviceId, staffId, dateKey]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="text-base font-semibold">Pick a time</h2>

      {notice === "slot_taken" && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          That time was just booked by someone else — please pick another.
        </p>
      )}

      {staffOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="availability-staff">Staff member</Label>
          <Select
            value={staffId ?? ANY_STAFF}
            onValueChange={(value) => onSelectStaff(value === ANY_STAFF ? undefined : value)}
          >
            <SelectTrigger id="availability-staff" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_STAFF}>Any available staff</SelectItem>
              {staffOptions.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Calendar
        mode="single"
        selected={date}
        onSelect={(value) => value && setDate(value)}
        disabled={{ before: today }}
        className="self-center"
      />

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {loading && <p className="text-sm text-muted-foreground">Loading available times…</p>}
        {!loading && error && (
          <p className="text-sm text-destructive">Couldn't load availability — please try again.</p>
        )}
        {!loading && !error && slots.length === 0 && (
          <p className="text-sm text-muted-foreground">No available times on this date.</p>
        )}
        {!loading &&
          !error &&
          slots.map((slot) => (
            <Button
              key={`${slot.staffId}-${slot.startsAt}`}
              type="button"
              variant="outline"
              onClick={() => onSelectSlot(slot)}
            >
              {new Date(slot.startsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </Button>
          ))}
      </div>

      <Button type="button" variant="ghost" onClick={onBack}>
        Back
      </Button>
    </div>
  );
}
