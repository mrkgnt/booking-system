import { describe, expect, it } from "vitest";
import { formatBookingTime, toDatetimeLocalValue } from "../../src/lib/format.js";

describe("formatBookingTime", () => {
  it("formats an ISO timestamp in the clinic's timezone", () => {
    expect(formatBookingTime("2026-03-15T09:00:00Z")).toMatch(/15 Mar 2026/);
  });
});

describe("toDatetimeLocalValue", () => {
  it("produces a value usable by <input type=datetime-local>", () => {
    expect(toDatetimeLocalValue("2026-03-15T09:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
