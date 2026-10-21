import type { TypedSupabaseClient } from "./supabase.js";
import { hashToken } from "./tokens.js";

// Shared capability-token validation, extracted out of routes/bookings.ts's
// /bookings/cancel and /bookings/reschedule handlers (which used to inline
// this identically) so routes/booking-lookup.ts's read-only lookup can reuse
// the exact same rules rather than re-deriving them. These are capability
// tokens, not single-use — validity is expires_at/booking-status based, not
// used_at-based (see CLAUDE.md's "Cancel/reschedule token model" decision).

const FINALIZED_STATUSES = ["cancelled", "completed", "no_show"] as const;

export type CapabilityTokenPurpose = "cancel" | "reschedule";

export type CapabilityTokenBooking = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  service_id: string;
  staff_id: string | null;
};

// Three-way status alongside `ok: true` rather than three separate error
// variants: callers that must block an action on a finalized/past booking
// (cancel, reschedule) treat anything other than "valid" as a hard error;
// the read-only lookup route treats all three as a successful lookup — the
// customer should still be able to see what happened to their booking even
// once it's finalized or past. See CLAUDE.md / the #8 ticket notes for why
// the lookup route deliberately doesn't reuse the "reject" branch.
export type CapabilityTokenValidation =
  | { ok: true; status: "valid" | "already_finalized" | "appointment_already_passed"; booking: CapabilityTokenBooking }
  | { ok: false; error: "invalid_or_expired_token" };

export async function validateCapabilityToken(
  supabase: TypedSupabaseClient,
  rawToken: string,
  purpose: CapabilityTokenPurpose | readonly CapabilityTokenPurpose[],
): Promise<CapabilityTokenValidation> {
  const purposes = Array.isArray(purpose) ? purpose : [purpose];
  const tokenHash = hashToken(rawToken);

  const { data: tokenRow } = await supabase
    .from("booking_verification_tokens")
    .select("id, booking_id, expires_at, purpose")
    .eq("token_hash", tokenHash)
    .in("purpose", purposes)
    .maybeSingle();

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return { ok: false, error: "invalid_or_expired_token" };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, starts_at, ends_at, service_id, staff_id")
    .eq("id", tokenRow.booking_id)
    .maybeSingle();

  if (!booking) {
    return { ok: false, error: "invalid_or_expired_token" };
  }
  if (FINALIZED_STATUSES.includes(booking.status as (typeof FINALIZED_STATUSES)[number])) {
    return { ok: true, status: "already_finalized", booking };
  }
  if (new Date(booking.starts_at) < new Date()) {
    return { ok: true, status: "appointment_already_passed", booking };
  }

  return { ok: true, status: "valid", booking };
}
