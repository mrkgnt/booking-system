import { describe, expect, it } from "vitest";
import {
  addWeeks,
  formatDayLabel,
  formatWeekRangeLabel,
  getWeekDays,
  getWeekStart,
  toDateKey,
} from "../../../src/lib/dashboard/date-utils.js";

describe("getWeekStart", () => {
  it("returns the same date when given a Monday", () => {
    expect(toDateKey(getWeekStart(new Date(2026, 0, 5)))).toBe("2026-01-05");
  });
  it("returns the preceding Monday for a mid-week date", () => {
    expect(toDateKey(getWeekStart(new Date(2026, 0, 7)))).toBe("2026-01-05");
  });
  it("returns the preceding Monday for a Sunday", () => {
    expect(toDateKey(getWeekStart(new Date(2026, 0, 11)))).toBe("2026-01-05");
  });
});

describe("getWeekDays", () => {
  it("returns 7 consecutive days starting at weekStart", () => {
    const days = getWeekDays(new Date(2026, 0, 5));
    expect(days).toHaveLength(7);
    expect(toDateKey(days[0])).toBe("2026-01-05");
    expect(toDateKey(days[6])).toBe("2026-01-11");
  });
});

describe("addWeeks", () => {
  it("moves forward by n weeks", () => {
    expect(toDateKey(addWeeks(new Date(2026, 0, 5), 1))).toBe("2026-01-12");
  });
  it("moves backward with a negative n", () => {
    expect(toDateKey(addWeeks(new Date(2026, 0, 5), -1))).toBe("2025-12-29");
  });
});

describe("toDateKey", () => {
  it("pads single-digit month and day", () => {
    expect(toDateKey(new Date(2026, 2, 5))).toBe("2026-03-05");
  });
});

describe("formatDayLabel", () => {
  it("formats a weekday abbreviation with day and month", () => {
    expect(formatDayLabel(new Date(2026, 0, 5))).toBe("Mon 5 Jan");
  });
});

describe("formatWeekRangeLabel", () => {
  it("formats a Mon-Sun range", () => {
    expect(formatWeekRangeLabel(new Date(2026, 0, 5))).toBe("5 Jan – 11 Jan, 2026");
  });
});
