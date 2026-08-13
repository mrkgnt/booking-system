import { describe, expect, it } from "vitest";
import {
  computeAvailableSlots,
  type BusinessHoursRow,
  type ClosureRow,
  type ExistingBookingInterval,
} from "../src/lib/availability.js";

const TZ = "Europe/Riga";
const STAFF_A = "staff-a";
const STAFF_B = "staff-b";

// A Monday, chosen arbitrarily and fixed so tests aren't date-sensitive.
const MONDAY = "2027-03-01";
const MONDAY_DOW = 1;

const businessWideHours: BusinessHoursRow[] = [
  { staffId: null, dayOfWeek: MONDAY_DOW, opensAt: "09:00", closesAt: "18:00", isClosed: false },
];

const baseParams = {
  date: MONDAY,
  timezone: TZ,
  serviceDurationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  candidateStaffIds: [STAFF_A],
  businessHours: businessWideHours,
  closures: [] as ClosureRow[],
  existingBookings: [] as ExistingBookingInterval[],
  slotGranularityMinutes: 30,
  minLeadMinutes: 0,
  now: new Date("2027-02-01T00:00:00Z"), // well before MONDAY, so lead time never filters
};

describe("computeAvailableSlots", () => {
  it("generates slots across the full business-wide window", () => {
    const slots = computeAvailableSlots(baseParams);
    // 09:00-18:00 Riga (winter UTC+2) in 30-min service / 30-min granularity = 18 slots
    expect(slots.length).toBe(18);
    expect(slots[0].staffId).toBe(STAFF_A);
  });

  it("prefers a staff-specific hours row over the business-wide default", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      businessHours: [
        ...businessWideHours,
        { staffId: STAFF_A, dayOfWeek: MONDAY_DOW, opensAt: "10:00", closesAt: "12:00", isClosed: false },
      ],
    });
    // Staff-specific window is narrower: 10:00-12:00 = 4 slots of 30min
    expect(slots.length).toBe(4);
  });

  it("returns nothing when the resolved hours row is_closed", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      businessHours: [{ staffId: null, dayOfWeek: MONDAY_DOW, opensAt: null, closesAt: null, isClosed: true }],
    });
    expect(slots).toEqual([]);
  });

  it("returns nothing when no hours row exists for that day-of-week", () => {
    const slots = computeAvailableSlots({ ...baseParams, businessHours: [] });
    expect(slots).toEqual([]);
  });

  it("a whole-day closure removes all slots for that staff", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      closures: [{ staffId: null, startsOn: MONDAY, endsOn: MONDAY, isRecurringYearly: false }],
    });
    expect(slots).toEqual([]);
  });

  it("a recurring-yearly closure matches by month/day regardless of year", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      closures: [
        { staffId: null, startsOn: "2020-03-01", endsOn: "2020-03-01", isRecurringYearly: true },
      ],
    });
    expect(slots).toEqual([]);
  });

  it("a recurring-yearly closure wrapping the year boundary matches correctly", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      date: "2027-12-25",
      closures: [
        { staffId: null, startsOn: "2020-12-24", endsOn: "2020-01-02", isRecurringYearly: true },
      ],
    });
    expect(slots).toEqual([]);
  });

  it("an existing booking's own buffer-after excludes a slot that would otherwise be free", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      existingBookings: [
        {
          staffId: STAFF_A,
          startsAt: "2027-03-01T08:00:00.000Z", // 10:00 Riga
          endsAt: "2027-03-01T08:30:00.000Z", // 10:30 Riga
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 15, // needs 15min cleanup after
        },
      ],
    });
    const startsAtTimes = slots.map((s) => s.startsAt);
    // 10:00 (the booking itself) and 10:30 (falls inside the 15min
    // buffer-after, which extends the occupied window to 10:45) are both
    // excluded; 11:00, clear of the buffer, is allowed.
    expect(startsAtTimes).not.toContain("2027-03-01T08:00:00.000Z");
    expect(startsAtTimes).not.toContain("2027-03-01T08:30:00.000Z");
    expect(startsAtTimes).toContain("2027-03-01T09:00:00.000Z");
  });

  it("allows a slot immediately adjacent to an existing booking with zero buffer", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      existingBookings: [
        {
          staffId: STAFF_A,
          startsAt: "2027-03-01T07:00:00.000Z", // 09:00 Riga
          endsAt: "2027-03-01T07:30:00.000Z", // 09:30 Riga
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
        },
      ],
    });
    const startsAtTimes = slots.map((s) => s.startsAt);
    expect(startsAtTimes).not.toContain("2027-03-01T07:00:00.000Z");
    expect(startsAtTimes).toContain("2027-03-01T07:30:00.000Z"); // 09:30 Riga, back-to-back
  });

  it("merges slots across multiple candidate staff, tagging each with its staffId", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      candidateStaffIds: [STAFF_A, STAFF_B],
      businessHours: [
        { staffId: null, dayOfWeek: MONDAY_DOW, opensAt: "09:00", closesAt: "10:00", isClosed: false },
      ],
    });
    const staffIds = new Set(slots.map((s) => s.staffId));
    expect(staffIds).toEqual(new Set([STAFF_A, STAFF_B]));
  });

  it("filters out slots starting before now + minLeadMinutes", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      businessHours: [
        { staffId: null, dayOfWeek: MONDAY_DOW, opensAt: "09:00", closesAt: "11:00", isClosed: false },
      ],
      minLeadMinutes: 60,
      now: new Date("2027-03-01T08:00:00.000Z"), // 10:00 Riga, same day
    });
    // Only slots starting at/after 11:00 Riga (08:00Z + 60min lead = 09:00Z = 11:00 Riga)
    // would qualify, but the window closes at 11:00 Riga too — so nothing.
    expect(slots).toEqual([]);
  });
});
