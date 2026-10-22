import { describe, expect, it } from "vitest";
import { isSlotStillAvailable, resolveDraftResume } from "../../../src/lib/booking/draft-resume.js";
import type { AvailabilitySlot } from "../../../src/lib/api/booking.js";

const SLOT: AvailabilitySlot = {
  staffId: "staff-1",
  startsAt: "2026-11-01T10:00:00.000Z",
  endsAt: "2026-11-01T10:45:00.000Z",
};

const OTHER_SLOT: AvailabilitySlot = {
  staffId: "staff-2",
  startsAt: "2026-11-01T11:00:00.000Z",
  endsAt: "2026-11-01T11:45:00.000Z",
};

describe("isSlotStillAvailable", () => {
  it("is true when a slot with the same staffId + startsAt is present", () => {
    expect(isSlotStillAvailable([OTHER_SLOT, SLOT], SLOT)).toBe(true);
  });

  it("is false when no slot matches", () => {
    expect(isSlotStillAvailable([OTHER_SLOT], SLOT)).toBe(false);
  });

  it("is false against an empty list", () => {
    expect(isSlotStillAvailable([], SLOT)).toBe(false);
  });

  it("treats a same-time slot under a different staffId as a different slot", () => {
    const sameTimeDifferentStaff: AvailabilitySlot = { ...SLOT, staffId: "staff-9" };
    expect(isSlotStillAvailable([sameTimeDifferentStaff], SLOT)).toBe(false);
  });
});

describe("resolveDraftResume", () => {
  it("resolves to 'none' when there is no saved draft", () => {
    expect(resolveDraftResume(null, [SLOT])).toEqual({ kind: "none" });
  });

  it("resumes a 'service' draft as-is — nothing to revalidate", () => {
    const draft = { step: "service" as const };
    expect(resolveDraftResume(draft, null)).toEqual({ kind: "resume", state: draft });
  });

  it("resumes an 'availability' draft as-is — no slot locked in yet", () => {
    const draft = { step: "availability" as const, serviceId: "svc-1", staffId: "staff-1" };
    expect(resolveDraftResume(draft, null)).toEqual({ kind: "resume", state: draft });
  });

  it("resumes a 'contact' draft when the saved slot is still among the fresh slots", () => {
    const draft = { step: "contact" as const, serviceId: "svc-1", staffId: "staff-1", slot: SLOT };
    expect(resolveDraftResume(draft, [SLOT, OTHER_SLOT])).toEqual({ kind: "resume", state: draft });
  });

  it("bounces a 'contact' draft back to availability with a slot_taken notice when the slot is gone", () => {
    const draft = { step: "contact" as const, serviceId: "svc-1", staffId: "staff-1", slot: SLOT };
    expect(resolveDraftResume(draft, [OTHER_SLOT])).toEqual({
      kind: "bounced",
      state: { step: "availability", serviceId: "svc-1", staffId: "staff-1", notice: "slot_taken" },
    });
  });

  it("bounces a 'contact' draft back to availability, dropping staffId, when the draft had none", () => {
    const draft = { step: "contact" as const, serviceId: "svc-1", slot: SLOT };
    expect(resolveDraftResume(draft, [])).toEqual({
      kind: "bounced",
      state: { step: "availability", serviceId: "svc-1", notice: "slot_taken" },
    });
  });

  it("fails closed: a 'contact' draft bounces back when revalidation itself couldn't be performed (null freshSlots)", () => {
    const draft = { step: "contact" as const, serviceId: "svc-1", staffId: "staff-1", slot: SLOT };
    expect(resolveDraftResume(draft, null)).toEqual({
      kind: "bounced",
      state: { step: "availability", serviceId: "svc-1", staffId: "staff-1", notice: "slot_taken" },
    });
  });
});
