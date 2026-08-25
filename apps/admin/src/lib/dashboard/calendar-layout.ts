const TIMEZONE = "Europe/Riga";
const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const TIME_PARTS_FORMAT = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** 'YYYY-MM-DD' calendar date (Europe/Riga) for a UTC ISO instant. */
export function toRigaDateKey(isoInstant: string): string {
  return DATE_KEY_FORMAT.format(new Date(isoInstant));
}

/** Minutes since local midnight (Europe/Riga) for a UTC ISO instant. */
export function minutesSinceMidnight(isoInstant: string): number {
  const parts = TIME_PARTS_FORMAT.formatToParts(new Date(isoInstant));
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute;
}

export type GridWindow = { startHour: number; endHour: number; pxPerHour: number };
export type GridPosition = { topPx: number; heightPx: number };

const MIN_HEIGHT_MINUTES = 15;

/**
 * Vertical position/height for an event within a single day's column,
 * clamped to [startHour, endHour). The caller is responsible for bucketing
 * events into day columns via toRigaDateKey before calling this — this
 * function only positions within a single day, it doesn't check which day.
 */
export function computeEventPosition(startsAt: string, endsAt: string, window: GridWindow): GridPosition | null {
  const gridStartMin = window.startHour * 60;
  const gridEndMin = window.endHour * 60;
  const startMin = minutesSinceMidnight(startsAt);
  let endMin = minutesSinceMidnight(endsAt);
  // A booking crossing local midnight isn't expected in practice (services
  // are same-day), but clip to the grid end rather than produce a negative
  // duration if it ever happens.
  if (endMin <= startMin) endMin = gridEndMin;
  if (endMin <= gridStartMin || startMin >= gridEndMin) return null;
  const clampedStart = Math.max(startMin, gridStartMin);
  const clampedEnd = Math.min(endMin, gridEndMin);
  const pxPerMinute = window.pxPerHour / 60;
  return {
    topPx: (clampedStart - gridStartMin) * pxPerMinute,
    heightPx: Math.max(clampedEnd - clampedStart, MIN_HEIGHT_MINUTES) * pxPerMinute,
  };
}

export type BusinessHoursWindow = { opensAt: string | null; closesAt: string | null; isClosed: boolean };

/** Shaded "open" region for one day, in the same coordinate space as computeEventPosition. */
export function computeOpenHoursPosition(hours: BusinessHoursWindow | undefined, window: GridWindow): GridPosition | null {
  if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) return null;
  const [openH, openM] = hours.opensAt.split(":").map(Number);
  const [closeH, closeM] = hours.closesAt.split(":").map(Number);
  const opensMin = openH * 60 + openM;
  const closesMin = closeH * 60 + closeM;
  const gridStartMin = window.startHour * 60;
  const gridEndMin = window.endHour * 60;
  if (closesMin <= gridStartMin || opensMin >= gridEndMin) return null;
  const clampedOpens = Math.max(opensMin, gridStartMin);
  const clampedCloses = Math.min(closesMin, gridEndMin);
  const pxPerMinute = window.pxPerHour / 60;
  return {
    topPx: (clampedOpens - gridStartMin) * pxPerMinute,
    heightPx: (clampedCloses - clampedOpens) * pxPerMinute,
  };
}

export type ClosureRange = { staffId: string | null; startsOn: string; endsOn: string; isRecurringYearly: boolean };

/**
 * Whether `dateKey` ('YYYY-MM-DD') falls inside any closure applicable to
 * `staffId` — a business-wide closure (staffId: null) applies to every
 * staff scope. Recurring-yearly closures are compared by month-day only,
 * matching the display-only precision this dashboard needs (the source of
 * truth for actual booking availability remains apps/api's availability.ts).
 */
export function isDateClosed(dateKey: string, closures: ClosureRange[], staffId: string | null): boolean {
  return closures.some((c) => {
    if (c.staffId !== null && c.staffId !== staffId) return false;
    if (c.isRecurringYearly) {
      const monthDay = dateKey.slice(5);
      const startMonthDay = c.startsOn.slice(5);
      const endMonthDay = c.endsOn.slice(5);
      if (startMonthDay <= endMonthDay) {
        return monthDay >= startMonthDay && monthDay <= endMonthDay;
      }
      // Wraps the year boundary (e.g. Dec 24 - Jan 2).
      return monthDay >= startMonthDay || monthDay <= endMonthDay;
    }
    return dateKey >= c.startsOn && dateKey <= c.endsOn;
  });
}
