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

  // Issue #15 — resuming a persisted draft (possibly already revalidated
  // against a fresh availability check) replaces whatever state the
  // reducer started in, regardless of where it started. A thin passthrough
  // rather than a new "resuming" state machine, so the resumed state stays
  // the single source of truth for the UI either way.
  it("RESUME_DRAFT replaces the current state outright, from any starting step", () => {
    const next = reduceFlowState(initialFlowState(), {
      type: "RESUME_DRAFT",
      state: { step: "availability", serviceId: "svc-1", staffId: "staff-1" },
    });
    expect(next).toEqual({ step: "availability", serviceId: "svc-1", staffId: "staff-1" });
  });

  // Issue #15 — the contact step's typed-but-not-yet-submitted fields need
  // to be part of what's persisted/resumed too (acceptance criteria:
  // "contact info fields"), even though they live in ContactStep's own
  // local state day-to-day — UPDATE_CONTACT_DRAFT is how DrawerContent
  // mirrors that local state back into the reducer for persistence.
  it("UPDATE_CONTACT_DRAFT merges partial contact fields while on the contact step", () => {
    const onContact = {
      step: "contact" as const,
      serviceId: "svc-1",
      staffId: "staff-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
    };
    const next = reduceFlowState(onContact, {
      type: "UPDATE_CONTACT_DRAFT",
      contact: { name: "Jane" },
    });
    expect(next).toEqual({ ...onContact, contactDraft: { name: "Jane" } });

    const next2 = reduceFlowState(next, {
      type: "UPDATE_CONTACT_DRAFT",
      contact: { email: "jane@example.com" },
    });
    expect(next2).toEqual({ ...onContact, contactDraft: { name: "Jane", email: "jane@example.com" } });
  });

  it("UPDATE_CONTACT_DRAFT is a no-op outside the contact step", () => {
    const onAvailability = { step: "availability" as const, serviceId: "svc-1" };
    const next = reduceFlowState(onAvailability, {
      type: "UPDATE_CONTACT_DRAFT",
      contact: { name: "Jane" },
    });
    expect(next).toEqual(onAvailability);
  });
});
