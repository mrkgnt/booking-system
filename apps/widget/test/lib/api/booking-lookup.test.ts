import { describe, expect, it } from "vitest";
import { buildBookingLookupUrl, isActionable } from "../../../src/lib/api/booking-lookup.js";

describe("buildBookingLookupUrl", () => {
  it("builds the GET /public/bookings/lookup URL with the token", () => {
    expect(buildBookingLookupUrl("http://localhost:8787", "some-token")).toBe(
      "http://localhost:8787/public/bookings/lookup?token=some-token",
    );
  });

  it("appends a locale query param when given", () => {
    expect(buildBookingLookupUrl("http://localhost:8787", "some-token", "ru")).toBe(
      "http://localhost:8787/public/bookings/lookup?token=some-token&locale=ru",
    );
  });

  it("strips a trailing slash on the API base URL", () => {
    expect(buildBookingLookupUrl("http://localhost:8787/", "some-token")).toBe(
      "http://localhost:8787/public/bookings/lookup?token=some-token",
    );
  });

  it("URL-encodes the token", () => {
    expect(buildBookingLookupUrl("http://localhost:8787", "a+b/c")).toBe(
      "http://localhost:8787/public/bookings/lookup?token=a%2Bb%2Fc",
    );
  });
});

describe("isActionable", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  it("is reschedulable for a confirmed booking in the future", () => {
    expect(isActionable({ status: "confirmed", startsAt: future })).toEqual({ ok: true });
  });

  it("is reschedulable for a still-pending-confirmation booking in the future", () => {
    expect(isActionable({ status: "pending_verification", startsAt: future })).toEqual({ ok: true });
  });

  it("is not reschedulable once cancelled", () => {
    expect(isActionable({ status: "cancelled", startsAt: future })).toEqual({
      ok: false,
      reason: "already_finalized",
    });
  });

  it("is not reschedulable once completed", () => {
    expect(isActionable({ status: "completed", startsAt: future })).toEqual({
      ok: false,
      reason: "already_finalized",
    });
  });

  it("is not reschedulable once marked no_show", () => {
    expect(isActionable({ status: "no_show", startsAt: future })).toEqual({
      ok: false,
      reason: "already_finalized",
    });
  });

  it("is not reschedulable once the appointment has already passed, even if still 'confirmed'", () => {
    expect(isActionable({ status: "confirmed", startsAt: past })).toEqual({
      ok: false,
      reason: "already_passed",
    });
  });
});
