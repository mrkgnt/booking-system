import { zonedTimeToUtc } from "./timezone.js";

// Pure, dependency-free (besides timezone.ts) availability calculation —
// no Supabase/network access here so it's fully unit-testable. Route-level
// orchestration (fetching these inputs from Supabase) lives in
// routes/availability.ts.

export type BusinessHoursRow = {
  staffId: string | null; // null = business-wide default
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday), matches Postgres EXTRACT(DOW)
  opensAt: string | null; // 'HH:MM' or 'HH:MM:SS'
  closesAt: string | null;
  isClosed: boolean;
};

export type ClosureRow = {
  staffId: string | null; // null = whole business
  startsOn: string; // 'YYYY-MM-DD'
  endsOn: string;
  isRecurringYearly: boolean;
};

export type ExistingBookingInterval = {
  staffId: string;
  startsAt: string; // ISO instant
  endsAt: string;
  bufferBeforeMinutes: number; // from the existing booking's own service
  bufferAfterMinutes: number;
};

export type AvailabilitySlot = {
  staffId: string;
  startsAt: string; // ISO instant
  endsAt: string;
};

export type ComputeAvailableSlotsParams = {
  date: string; // 'YYYY-MM-DD', tenant-local calendar date
  timezone: string; // business_profile.timezone, e.g. 'Europe/Riga'
  serviceDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  candidateStaffIds: string[];
  businessHours: BusinessHoursRow[];
  closures: ClosureRow[];
  existingBookings: ExistingBookingInterval[];
  slotGranularityMinutes: number;
  minLeadMinutes: number;
  now?: Date; // injectable for testing; defaults to real now
};

function dayOfWeekFromDateString(dateISO: string): number {
  // Day-of-week of a tenant-local calendar date doesn't depend on timezone
  // conversion — the date string already represents the local calendar day.
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

function isDateInClosureRange(dateISO: string, closure: ClosureRow): boolean {
  if (!closure.isRecurringYearly) {
    return dateISO >= closure.startsOn && dateISO <= closure.endsOn;
  }
  const monthDay = dateISO.slice(5); // 'MM-DD'
  const startMonthDay = closure.startsOn.slice(5);
  const endMonthDay = closure.endsOn.slice(5);
  if (startMonthDay <= endMonthDay) {
    return monthDay >= startMonthDay && monthDay <= endMonthDay;
  }
  // Wraps the year boundary (e.g. Dec 24 - Jan 2).
  return monthDay >= startMonthDay || monthDay <= endMonthDay;
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Exported for reuse by the pre-insert re-check in routes/bookings.ts —
// same buffer-aware overlap logic used during slot generation below. The
// DB's exclusion constraint (bookings_no_overlap) only knows about literal
// starts_at/ends_at overlap, not per-service buffers, so this app-level
// check is what actually enforces buffer gaps; the DB constraint is the
// backstop for the exact-overlap race condition specifically.
export function hasBufferConflict(
  candidate: { startsAt: string; endsAt: string; bufferBeforeMinutes: number; bufferAfterMinutes: number },
  existingBookings: ExistingBookingInterval[],
): boolean {
  const occupiedStart = new Date(candidate.startsAt).getTime() - candidate.bufferBeforeMinutes * 60_000;
  const occupiedEnd = new Date(candidate.endsAt).getTime() + candidate.bufferAfterMinutes * 60_000;

  return existingBookings.some((b) => {
    const existingStart = new Date(b.startsAt).getTime() - b.bufferBeforeMinutes * 60_000;
    const existingEnd = new Date(b.endsAt).getTime() + b.bufferAfterMinutes * 60_000;
    return intervalsOverlap(occupiedStart, occupiedEnd, existingStart, existingEnd);
  });
}

export function computeAvailableSlots(params: ComputeAvailableSlotsParams): AvailabilitySlot[] {
  const {
    date,
    timezone,
    serviceDurationMinutes,
    bufferBeforeMinutes,
    bufferAfterMinutes,
    candidateStaffIds,
    businessHours,
    closures,
    existingBookings,
    slotGranularityMinutes,
    minLeadMinutes,
    now = new Date(),
  } = params;

  const dayOfWeek = dayOfWeekFromDateString(date);
  const earliestStartMs = now.getTime() + minLeadMinutes * 60_000;
  const slots: AvailabilitySlot[] = [];

  for (const staffId of candidateStaffIds) {
    // Staff-specific hours row for this day-of-week takes priority over the
    // business-wide (staffId === null) default.
    const hoursRow =
      businessHours.find((h) => h.staffId === staffId && h.dayOfWeek === dayOfWeek) ??
      businessHours.find((h) => h.staffId === null && h.dayOfWeek === dayOfWeek);

    if (!hoursRow || hoursRow.isClosed || !hoursRow.opensAt || !hoursRow.closesAt) {
      continue;
    }

    const isClosedToday = closures.some(
      (c) => (c.staffId === null || c.staffId === staffId) && isDateInClosureRange(date, c),
    );
    if (isClosedToday) {
      continue;
    }

    const windowStart = zonedTimeToUtc(date, hoursRow.opensAt, timezone);
    const windowEnd = zonedTimeToUtc(date, hoursRow.closesAt, timezone);

    const staffExistingBookings = existingBookings.filter((b) => b.staffId === staffId);

    for (
      let slotStartMs = windowStart.getTime();
      slotStartMs + serviceDurationMinutes * 60_000 <= windowEnd.getTime();
      slotStartMs += slotGranularityMinutes * 60_000
    ) {
      const slotEndMs = slotStartMs + serviceDurationMinutes * 60_000;

      if (slotStartMs < earliestStartMs) {
        continue;
      }

      const conflicts = hasBufferConflict(
        {
          startsAt: new Date(slotStartMs).toISOString(),
          endsAt: new Date(slotEndMs).toISOString(),
          bufferBeforeMinutes,
          bufferAfterMinutes,
        },
        staffExistingBookings,
      );

      if (conflicts) {
        continue;
      }

      slots.push({
        staffId,
        startsAt: new Date(slotStartMs).toISOString(),
        endsAt: new Date(slotEndMs).toISOString(),
      });
    }
  }

  return slots;
}
