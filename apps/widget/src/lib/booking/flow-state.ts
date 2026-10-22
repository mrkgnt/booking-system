// Pure wizard state machine for the Drawer's booking flow (issue #14):
// service → availability → contact → confirm_pending → confirmed, plus the
// "slot taken while the customer was filling in contact info" bounce-back
// to availability (issue #6 story 13). Kept DOM-free and side-effect-free
// on purpose — this is the one piece of the flow worth a dedicated vitest
// seam; the React components in src/components/booking/ are thin wrappers
// that call reduceFlowState and render whatever `state.step` says, covered
// instead by Playwright E2E per this app's existing convention (see
// DrawerContent.tsx/DrawerLayout.astro, neither of which has a unit test).

import type { AvailabilitySlot } from "../api/booking.js";

export type FlowState =
  | { step: "service" }
  | { step: "availability"; serviceId: string; staffId?: string; notice?: "slot_taken" }
  | {
      step: "contact";
      serviceId: string;
      staffId?: string;
      slot: AvailabilitySlot;
      // Mirrors ContactStep's own local form state (issue #15) purely so it
      // can be persisted/resumed as part of the draft — ContactStep itself
      // stays the source of truth for rendering; this is a one-way copy
      // written via UPDATE_CONTACT_DRAFT, not read back by ContactStep
      // except as its resume-time initial value.
      contactDraft?: { name?: string; email?: string; phone?: string };
    }
  | {
      step: "confirm_pending";
      serviceId: string;
      staffId?: string;
      slot: AvailabilitySlot;
      bookingId: string;
      devConfirmUrl?: string;
    }
  | {
      step: "confirmed";
      serviceId: string;
      staffId?: string;
      slot: AvailabilitySlot;
      bookingId: string;
      devConfirmUrl?: string;
    };

export type FlowAction =
  | { type: "SELECT_SERVICE"; serviceId: string }
  | { type: "SELECT_STAFF"; staffId: string | undefined }
  | { type: "SELECT_SLOT"; slot: AvailabilitySlot }
  | { type: "BOOKING_CREATED"; bookingId: string; devConfirmUrl?: string }
  | { type: "CONFIRMED" }
  | { type: "SLOT_TAKEN" }
  | { type: "BACK" }
  | { type: "RESTART" }
  // Issue #15 — applies an already-resolved resume state (plain state, not
  // selected slot: produced by resolveDraftResume against either the saved
  // draft as-is or a bounced-back "slot taken" availability state) outright,
  // from whatever step the reducer happened to start in.
  | { type: "RESUME_DRAFT"; state: FlowState }
  // Issue #15 — mirrors ContactStep's own local field state back into the
  // reducer, so it becomes part of what gets persisted as the draft.
  | { type: "UPDATE_CONTACT_DRAFT"; contact: { name?: string; email?: string; phone?: string } };

export function initialFlowState(): FlowState {
  return { step: "service" };
}

export function reduceFlowState(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "SELECT_SERVICE":
      return { step: "availability", serviceId: action.serviceId };

    case "SELECT_STAFF":
      if (state.step !== "availability") return state;
      return action.staffId
        ? { step: "availability", serviceId: state.serviceId, staffId: action.staffId }
        : { step: "availability", serviceId: state.serviceId };

    case "SELECT_SLOT":
      if (state.step !== "availability") return state;
      return {
        step: "contact",
        serviceId: state.serviceId,
        staffId: action.slot.staffId,
        slot: action.slot,
      };

    case "BOOKING_CREATED":
      if (state.step !== "contact") return state;
      return {
        step: "confirm_pending",
        serviceId: state.serviceId,
        staffId: state.staffId,
        slot: state.slot,
        bookingId: action.bookingId,
        devConfirmUrl: action.devConfirmUrl,
      };

    case "CONFIRMED":
      if (state.step !== "confirm_pending") return state;
      return { ...state, step: "confirmed" };

    case "SLOT_TAKEN":
      if (state.step !== "contact") return state;
      return {
        step: "availability",
        serviceId: state.serviceId,
        staffId: state.staffId,
        notice: "slot_taken",
      };

    case "BACK":
      if (state.step === "availability") return { step: "service" };
      if (state.step === "contact") {
        return { step: "availability", serviceId: state.serviceId, staffId: state.staffId };
      }
      return state;

    // Lets a customer who just completed one booking start a second one in
    // the same drawer session without closing/reopening the iframe (the
    // widget is lazy-mounted once per host-page session per ADR-0004, so
    // there's otherwise no way back to "service" from "confirmed"). Valid
    // from any step, not just "confirmed" — harmless no-op difference from
    // "already on service" in every other case.
    case "RESTART":
      return initialFlowState();

    case "RESUME_DRAFT":
      return action.state;

    case "UPDATE_CONTACT_DRAFT":
      if (state.step !== "contact") return state;
      return { ...state, contactDraft: { ...state.contactDraft, ...action.contact } };

    default:
      return state;
  }
}
