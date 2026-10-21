import { describe, expect, it, vi } from "vitest";
import { validateCapabilityToken } from "../src/lib/booking-tokens.js";
import { hashToken } from "../src/lib/tokens.js";

// A hand-rolled fake standing in for TypedSupabaseClient's fluent builder —
// mirrors test/translations.test.ts's style. Routes `.from()` by table name
// since validateCapabilityToken touches two tables
// (booking_verification_tokens, then bookings).
function makeFakeSupabase(opts: {
  tokenRow: { id: string; booking_id: string; expires_at: string; purpose: string } | null;
  bookingRow: {
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    service_id: string;
    staff_id: string | null;
  } | null;
}) {
  const tokenMaybeSingle = vi.fn().mockResolvedValue({ data: opts.tokenRow, error: null });
  const tokenIn = vi.fn().mockReturnValue({ maybeSingle: tokenMaybeSingle });
  const tokenEq = vi.fn().mockReturnValue({ in: tokenIn });
  const tokenSelect = vi.fn().mockReturnValue({ eq: tokenEq });

  const bookingMaybeSingle = vi.fn().mockResolvedValue({ data: opts.bookingRow, error: null });
  const bookingEq = vi.fn().mockReturnValue({ maybeSingle: bookingMaybeSingle });
  const bookingSelect = vi.fn().mockReturnValue({ eq: bookingEq });

  const from = vi.fn((table: string) => {
    if (table === "booking_verification_tokens") return { select: tokenSelect };
    if (table === "bookings") return { select: bookingSelect };
    throw new Error(`unexpected table: ${table}`);
  });

  return { from, tokenSelect, tokenEq, tokenIn, tokenMaybeSingle, bookingSelect, bookingEq, bookingMaybeSingle };
}

describe("validateCapabilityToken", () => {
  const future = new Date(Date.now() + 60 * 60_000).toISOString();
  const past = new Date(Date.now() - 60 * 60_000).toISOString();

  it("returns invalid_or_expired_token when no token row matches", async () => {
    const supabase = makeFakeSupabase({ tokenRow: null, bookingRow: null });
    const result = await validateCapabilityToken(supabase as never, "raw-token", "cancel");
    expect(result).toEqual({ ok: false, error: "invalid_or_expired_token" });
    expect(supabase.tokenEq).toHaveBeenCalledWith("token_hash", hashToken("raw-token"));
    expect(supabase.tokenIn).toHaveBeenCalledWith("purpose", ["cancel"]);
  });

  it("returns invalid_or_expired_token when the token row is expired", async () => {
    const supabase = makeFakeSupabase({
      tokenRow: { id: "t1", booking_id: "b1", expires_at: past, purpose: "cancel" },
      bookingRow: null,
    });
    const result = await validateCapabilityToken(supabase as never, "raw-token", "cancel");
    expect(result).toEqual({ ok: false, error: "invalid_or_expired_token" });
  });

  it("returns invalid_or_expired_token when the token row exists but the booking is gone", async () => {
    const supabase = makeFakeSupabase({
      tokenRow: { id: "t1", booking_id: "b1", expires_at: future, purpose: "cancel" },
      bookingRow: null,
    });
    const result = await validateCapabilityToken(supabase as never, "raw-token", "cancel");
    expect(result).toEqual({ ok: false, error: "invalid_or_expired_token" });
  });

  it("returns status already_finalized for a cancelled booking, with the booking row attached", async () => {
    const supabase = makeFakeSupabase({
      tokenRow: { id: "t1", booking_id: "b1", expires_at: future, purpose: "cancel" },
      bookingRow: {
        id: "b1",
        status: "cancelled",
        starts_at: future,
        ends_at: future,
        service_id: "svc-1",
        staff_id: null,
      },
    });
    const result = await validateCapabilityToken(supabase as never, "raw-token", "cancel");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("already_finalized");
      expect(result.booking.id).toBe("b1");
    }
  });

  it("returns status appointment_already_passed when starts_at is in the past", async () => {
    const supabase = makeFakeSupabase({
      tokenRow: { id: "t1", booking_id: "b1", expires_at: future, purpose: "cancel" },
      bookingRow: {
        id: "b1",
        status: "confirmed",
        starts_at: past,
        ends_at: past,
        service_id: "svc-1",
        staff_id: null,
      },
    });
    const result = await validateCapabilityToken(supabase as never, "raw-token", "cancel");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("appointment_already_passed");
    }
  });

  it("returns status valid with the full booking row for a confirmed, upcoming booking", async () => {
    const bookingRow = {
      id: "b1",
      status: "confirmed",
      starts_at: future,
      ends_at: future,
      service_id: "svc-1",
      staff_id: "staff-1",
    };
    const supabase = makeFakeSupabase({
      tokenRow: { id: "t1", booking_id: "b1", expires_at: future, purpose: "reschedule" },
      bookingRow,
    });
    const result = await validateCapabilityToken(supabase as never, "raw-token", "reschedule");
    expect(result).toEqual({ ok: true, status: "valid", booking: bookingRow });
  });

  it("accepts an array of purposes and passes it through to the .in() filter", async () => {
    const bookingRow = {
      id: "b1",
      status: "confirmed",
      starts_at: future,
      ends_at: future,
      service_id: "svc-1",
      staff_id: null,
    };
    const supabase = makeFakeSupabase({
      tokenRow: { id: "t1", booking_id: "b1", expires_at: future, purpose: "cancel" },
      bookingRow,
    });
    const result = await validateCapabilityToken(supabase as never, "raw-token", ["cancel", "reschedule"]);
    expect(supabase.tokenIn).toHaveBeenCalledWith("purpose", ["cancel", "reschedule"]);
    expect(result).toEqual({ ok: true, status: "valid", booking: bookingRow });
  });
});
