import { describe, expect, it } from "vitest";
import {
  computeEventPosition,
  computeOpenHoursPosition,
  isDateClosed,
  minutesSinceMidnight,
  toRigaDateKey,
  type GridWindow,
} from "../../../src/lib/dashboard/calendar-layout.js";

describe("toRigaDateKey", () => {
  it("converts a UTC instant to its Europe/Riga calendar date", () => {
    // 22:30 UTC on Jan 5 is 00:30 the next day in Riga (winter, UTC+2)
    expect(toRigaDateKey("2026-01-05T22:30:00Z")).toBe("2026-01-06");
  });
});

describe("minutesSinceMidnight", () => {
  it("returns minutes since local midnight in Europe/Riga (winter, UTC+2)", () => {
    expect(minutesSinceMidnight("2026-01-05T07:30:00Z")).toBe(9 * 60 + 30);
  });
});

const window: GridWindow = { startHour: 8, endHour: 18, pxPerHour: 60 };

describe("computeEventPosition", () => {
  it("positions a booking fully inside the grid window", () => {
    // 07:00-07:30 UTC = 09:00-09:30 Riga (winter)
    expect(computeEventPosition("2026-01-05T07:00:00Z", "2026-01-05T07:30:00Z", window)).toEqual({
      topPx: 60,
      heightPx: 30,
    });
  });

  it("returns null for an event entirely outside the grid window", () => {
    // 18:00 Riga is exactly the grid end — outside the half-open window
    expect(computeEventPosition("2026-01-05T16:00:00Z", "2026-01-05T16:30:00Z", window)).toBeNull();
  });

  it("clamps an event that starts before the grid window", () => {
    // 07:00-09:00 Riga, grid starts at 08:00
    expect(computeEventPosition("2026-01-05T05:00:00Z", "2026-01-05T07:00:00Z", window)).toEqual({
      topPx: 0,
      heightPx: 60,
    });
  });

  it("enforces a 15-minute minimum visible height for very short bookings", () => {
    const pos = computeEventPosition("2026-01-05T07:00:00Z", "2026-01-05T07:05:00Z", window);
    expect(pos!.heightPx).toBe(15);
  });
});

describe("computeOpenHoursPosition", () => {
  it("positions the open-hours band for a normal day", () => {
    expect(
      computeOpenHoursPosition({ opensAt: "09:00:00", closesAt: "18:00:00", isClosed: false }, window),
    ).toEqual({ topPx: 60, heightPx: 540 });
  });

  it("returns null for a closed day", () => {
    expect(computeOpenHoursPosition({ opensAt: null, closesAt: null, isClosed: true }, window)).toBeNull();
  });

  it("returns null when hours are undefined (no matching row)", () => {
    expect(computeOpenHoursPosition(undefined, window)).toBeNull();
  });
});

describe("isDateClosed", () => {
  const closures = [
    { staffId: null, startsOn: "2026-12-24", endsOn: "2026-12-26", isRecurringYearly: false },
    { staffId: "staff-1", startsOn: "2026-06-01", endsOn: "2026-06-01", isRecurringYearly: false },
    { staffId: null, startsOn: "2020-01-01", endsOn: "2020-01-01", isRecurringYearly: true },
  ];

  it("matches a business-wide closure regardless of staffId", () => {
    expect(isDateClosed("2026-12-25", closures, "staff-1")).toBe(true);
    expect(isDateClosed("2026-12-25", closures, null)).toBe(true);
  });

  it("matches a staff-specific closure only for that staff", () => {
    expect(isDateClosed("2026-06-01", closures, "staff-1")).toBe(true);
    expect(isDateClosed("2026-06-01", closures, "staff-2")).toBe(false);
  });

  it("matches a recurring-yearly closure by month-day, any year", () => {
    expect(isDateClosed("2030-01-01", closures, null)).toBe(true);
    expect(isDateClosed("2030-01-02", closures, null)).toBe(false);
  });

  it("returns false when no closure matches", () => {
    expect(isDateClosed("2026-03-15", closures, null)).toBe(false);
  });

  it("matches a recurring-yearly closure that wraps the year boundary (Dec 24 - Jan 2), any year", () => {
    const wrapping = [
      { staffId: null, startsOn: "2020-12-24", endsOn: "2020-01-02", isRecurringYearly: true },
    ];
    // Inside the wrapped range, on either side of the boundary.
    expect(isDateClosed("2026-12-30", wrapping, null)).toBe(true);
    expect(isDateClosed("2026-01-01", wrapping, null)).toBe(true);
    // Outside the wrapped range.
    expect(isDateClosed("2026-06-15", wrapping, null)).toBe(false);
  });
});
