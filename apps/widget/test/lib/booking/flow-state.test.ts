import { describe, expect, it } from "vitest";
import { initialFlowState, reduceFlowState } from "../../../src/lib/booking/flow-state.js";

describe("booking flow state machine", () => {
  it("starts on the service step with nothing selected", () => {
    expect(initialFlowState()).toEqual({ step: "service" });
  });

  it("selecting a service advances to the availability step", () => {
    const next = reduceFlowState(initialFlowState(), {
      type: "SELECT_SERVICE",
      serviceId: "svc-1",
    });
    expect(next).toEqual({ step: "availability", serviceId: "svc-1" });
  });

  it("selecting a staff member while on the availability step is remembered", () => {
    const afterService = reduceFlowState(initialFlowState(), {
      type: "SELECT_SERVICE",
      serviceId: "svc-1",
    });
    const next = reduceFlowState(afterService, { type: "SELECT_STAFF", staffId: "staff-1" });
    expect(next).toEqual({ step: "availability", serviceId: "svc-1", staffId: "staff-1" });
  });

  it("selecting a slot advances to the contact step, carrying the slot forward", () => {
    const afterService = reduceFlowState(initialFlowState(), {
      type: "SELECT_SERVICE",
      serviceId: "svc-1",
    });
    const next = reduceFlowState(afterService, {
      type: "SELECT_SLOT",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
    });
    expect(next).toEqual({
      step: "contact",
      serviceId: "svc-1",
      staffId: "staff-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
    });
  });

  it("submitting the booking advances to the confirm-pending step with the dev confirm URL", () => {
    const afterSlot = {
      step: "contact" as const,
      serviceId: "svc-1",
      staffId: "staff-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
    };
    const next = reduceFlowState(afterSlot, {
      type: "BOOKING_CREATED",
      bookingId: "booking-1",
      devConfirmUrl: "http://localhost:8081/bookings/confirm?token=abc",
    });
    expect(next).toEqual({
      ...afterSlot,
      step: "confirm_pending",
      bookingId: "booking-1",
      devConfirmUrl: "http://localhost:8081/bookings/confirm?token=abc",
    });
  });

  it("a successful confirm advances to the confirmed step", () => {
    const pending = {
      step: "confirm_pending" as const,
      serviceId: "svc-1",
      staffId: "staff-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
      bookingId: "booking-1",
      devConfirmUrl: "http://localhost:8081/bookings/confirm?token=abc",
    };
    const next = reduceFlowState(pending, { type: "CONFIRMED" });
    expect(next).toEqual({ ...pending, step: "confirmed" });
  });

  it("a slot_unavailable error on submit routes back to the availability step with a note", () => {
    const afterSlot = {
      step: "contact" as const,
      serviceId: "svc-1",
      staffId: "staff-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
    };
    const next = reduceFlowState(afterSlot, { type: "SLOT_TAKEN" });
    expect(next).toEqual({
      step: "availability",
      serviceId: "svc-1",
      staffId: "staff-1",
      notice: "slot_taken",
    });
  });

  it("BACK from availability returns to the service step, dropping staff/slot selection", () => {
    const onAvailability = { step: "availability" as const, serviceId: "svc-1", staffId: "staff-1" };
    const next = reduceFlowState(onAvailability, { type: "BACK" });
    expect(next).toEqual({ step: "service" });
  });

  it("BACK from contact returns to the availability step, keeping service/staff but dropping the slot", () => {
    const onContact = {
      step: "contact" as const,
      serviceId: "svc-1",
      staffId: "staff-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
    };
    const next = reduceFlowState(onContact, { type: "BACK" });
    expect(next).toEqual({ step: "availability", serviceId: "svc-1", staffId: "staff-1" });
  });

  it("RESTART from the confirmed step returns all the way to the service step", () => {
    const confirmed = {
      step: "confirmed" as const,
      serviceId: "svc-1",
      staffId: "staff-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
      bookingId: "booking-1",
    };
    const next = reduceFlowState(confirmed, { type: "RESTART" });
    expect(next).toEqual({ step: "service" });
  });
});
