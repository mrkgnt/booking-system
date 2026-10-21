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
  | { step: "contact"; serviceId: string; staffId?: string; slot: AvailabilitySlot }
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
  | { type: "RESTART" };

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

    default:
      return state;
  }
}
