import { describe, expect, it } from "vitest";
import { buildAvailabilityUrl, buildCreateBookingPayload } from "../../../src/lib/api/booking.js";

describe("buildAvailabilityUrl", () => {
  it("builds the GET /availability URL with service_id and date query params", () => {
    expect(
      buildAvailabilityUrl("http://localhost:8787", { serviceId: "svc-1", date: "2026-11-01" }),
    ).toBe("http://localhost:8787/availability?service_id=svc-1&date=2026-11-01");
  });

  it("appends staff_id when a staffId is given", () => {
    expect(
      buildAvailabilityUrl("http://localhost:8787", {
        serviceId: "svc-1",
        date: "2026-11-01",
        staffId: "staff-1",
      }),
    ).toBe("http://localhost:8787/availability?service_id=svc-1&date=2026-11-01&staff_id=staff-1");
  });

  it("strips a trailing slash on the API base URL", () => {
    expect(
      buildAvailabilityUrl("http://localhost:8787/", { serviceId: "svc-1", date: "2026-11-01" }),
    ).toBe("http://localhost:8787/availability?service_id=svc-1&date=2026-11-01");
  });
});

describe("buildCreateBookingPayload", () => {
  it("builds a POST /bookings body matching createBookingSchema's exact shape", () => {
    const payload = buildCreateBookingPayload({
      serviceId: "svc-1",
      staffId: "staff-1",
      startsAt: "2026-11-01T10:00:00.000Z",
      locale: "lv",
      customer: { name: "Jane Doe", email: "jane@example.com" },
      idempotencyKey: "idem-key-0123456789",
    });

    expect(payload).toEqual({
      serviceId: "svc-1",
      staffId: "staff-1",
      startsAt: "2026-11-01T10:00:00.000Z",
      locale: "lv",
      customer: { name: "Jane Doe", email: "jane@example.com", phone: undefined },
      consentGiven: true,
      idempotencyKey: "idem-key-0123456789",
    });
  });

  it("omits staffId entirely when not given — 'any eligible staff'", () => {
    const payload = buildCreateBookingPayload({
      serviceId: "svc-1",
      startsAt: "2026-11-01T10:00:00.000Z",
      locale: "en",
      customer: { name: "Jane Doe", phone: "+37120000000" },
      idempotencyKey: "idem-key-0123456789",
    });

    expect(payload.staffId).toBeUndefined();
    expect(payload.customer).toEqual({ name: "Jane Doe", email: undefined, phone: "+37120000000" });
  });
});
