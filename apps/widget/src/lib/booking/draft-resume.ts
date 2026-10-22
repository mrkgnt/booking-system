// Booking draft resume-with-revalidation (issue #15). Pure decision logic,
// deliberately separate from the actual GET /availability network call
// (src/lib/api/booking.ts's fetchAvailability) so this module stays
// testable without a real fetch/browser — the caller (DrawerContent) is
// responsible for loading the raw draft (draft-storage.ts), running the
// revalidation fetch when the draft needs one, and handing the result here.
import type { AvailabilitySlot } from "../api/booking.js";
import type { FlowState } from "./flow-state.js";

// Same identity rule AvailabilityStep.tsx already uses to key slot buttons
// (`${slot.staffId}-${slot.startsAt}`) — a slot is "the same slot" iff both
// match; endsAt/service duration can't change independently of those two.
export function isSlotStillAvailable(freshSlots: AvailabilitySlot[], slot: AvailabilitySlot): boolean {
  return freshSlots.some((candidate) => candidate.staffId === slot.staffId && candidate.startsAt === slot.startsAt);
}

export type DraftResumeResult =
  | { kind: "none" }
  | { kind: "resume"; state: FlowState }
  | { kind: "bounced"; state: FlowState };

// `freshSlots`: the result of a fresh GET /availability call for the
// draft's own service/date/staff (or `null` when that call wasn't made —
// either because the draft's step doesn't need it, or because the caller
// couldn't complete it, e.g. a network error). A "contact" draft (the only
// step with an actual locked-in slot) fails CLOSED on `null` — if we can't
// prove the slot is still free, we don't let the customer resume straight
// to submitting it, same outcome as a confirmed steal.
export function resolveDraftResume(
  draft: FlowState | null,
  freshSlots: AvailabilitySlot[] | null,
): DraftResumeResult {
  if (!draft) return { kind: "none" };

  if (draft.step !== "contact") {
    // "service"/"availability" drafts never locked in a specific slot, so
    // there is nothing to revalidate — resume directly.
    return { kind: "resume", state: draft };
  }

  if (freshSlots && isSlotStillAvailable(freshSlots, draft.slot)) {
    return { kind: "resume", state: draft };
  }

  // Reuses the exact bounce-back shape flow-state.ts's own SLOT_TAKEN
  // transition produces (the same case issue #14 built for "slot taken
  // while filling in contact info") — same notice, same UI branch in
  // AvailabilityStep.tsx, no parallel mechanism.
  return {
    kind: "bounced",
    state: { step: "availability", serviceId: draft.serviceId, staffId: draft.staffId, notice: "slot_taken" },
  };
}
