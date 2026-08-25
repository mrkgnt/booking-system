import { describe, expect, it } from "vitest";
import { computeBookingStats } from "../../../src/lib/dashboard/dashboard-stats.js";

describe("computeBookingStats", () => {
  it("returns zero counts for an empty list", () => {
    expect(computeBookingStats([])).toEqual({ confirmed: 0, pending: 0, cancelled: 0 });
  });

  it("counts confirmed, pending_verification, and cancelled separately", () => {
    const bookings = [
      { status: "confirmed" },
      { status: "confirmed" },
      { status: "pending_verification" },
      { status: "cancelled" },
      { status: "cancelled" },
      { status: "cancelled" },
    ];
    expect(computeBookingStats(bookings)).toEqual({ confirmed: 2, pending: 1, cancelled: 3 });
  });

  it("ignores completed and no_show statuses", () => {
    const bookings = [{ status: "completed" }, { status: "no_show" }, { status: "confirmed" }];
    expect(computeBookingStats(bookings)).toEqual({ confirmed: 1, pending: 0, cancelled: 0 });
  });
});
