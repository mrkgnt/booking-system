// Shape of GET /public/bookings/lookup's response (apps/api/src/routes/
// booking-lookup.ts) — kept intentionally loose/duplicated here rather
// than importing apps/api's types, same as tenant-info.ts (ADR-0004,
// no shared packages). Used by both the reschedule (issue #16) and cancel
// (issue #17) standalone pages.
export type BookingLookup = {
  status: string;
  startsAt: string;
  endsAt: string;
  serviceId: string;
  staffId?: string;
  service: { name: string; description: string; durationMinutes: number | null };
  staff: { name: string } | null;
};

export type FetchBookingLookupResult =
  | { ok: true; booking: BookingLookup }
  | { ok: false; error: string };

// Pure — the one piece of this module worth a vitest seam on its own, same
// split as tenant-info.ts/booking.ts (the fetch calls themselves are
// exercised live via Playwright E2E against the real Dent Di project).
export function buildBookingLookupUrl(apiBaseUrl: string, token: string, locale?: string): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const query = new URLSearchParams();
  query.set("token", token);
  if (locale) query.set("locale", locale);
  return `${base}/public/bookings/lookup?${query.toString()}`;
}

// Server-side fetch, used by the reschedule/cancel pages' SSR frontmatter
// — mirrors tenant-info.ts's fetchTenantInfo in shape, but surfaces the
// specific error code (invalid_or_expired_token, validation_error, etc.)
// rather than collapsing to null, since these pages need to show a
// specific message for "bad token" vs. a generic failure.
export async function fetchBookingLookup(
  apiBaseUrl: string,
  tenantSlug: string,
  token: string,
  locale?: string,
): Promise<FetchBookingLookupResult> {
  try {
    const res = await fetch(buildBookingLookupUrl(apiBaseUrl, token, locale), {
      headers: { "X-Tenant-Slug": tenantSlug },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`[widget] GET /public/bookings/lookup failed for tenant "${tenantSlug}": ${res.status}`);
      return { ok: false, error: (body && body.error) || `http_${res.status}` };
    }
    return { ok: true, booking: body.booking as BookingLookup };
  } catch (err) {
    console.error(`[widget] GET /public/bookings/lookup errored for tenant "${tenantSlug}":`, err);
    return { ok: false, error: "network_error" };
  }
}

export type ActionabilityResult =
  | { ok: true }
  | { ok: false; reason: "already_finalized" | "already_passed" };

const FINALIZED_STATUSES = new Set(["cancelled", "completed", "no_show"]);

// Pure — booking-lookup's own HTTP response only carries the booking's raw
// status (e.g. "confirmed"), not the validation-level "already_finalized"/
// "appointment_already_passed" distinction apps/api's internal
// validateCapabilityToken computes (see its own CapabilityTokenValidation
// type) — that distinction never crosses the HTTP boundary. Re-derived
// here instead of threading an extra response field through, since both
// pieces of information (status, startsAt) are already in hand.
//
// Shared by both standalone pages (issue #16's reschedule, #17's cancel —
// renamed from the #16-only "isReschedulable" once #17 needed the
// identical check): a booking can be rescheduled OR cancelled exactly
// when it's neither already finalized nor already passed.
export function isActionable(booking: { status: string; startsAt: string }): ActionabilityResult {
  if (FINALIZED_STATUSES.has(booking.status)) {
    return { ok: false, reason: "already_finalized" };
  }
  if (new Date(booking.startsAt) < new Date()) {
    return { ok: false, reason: "already_passed" };
  }
  return { ok: true };
}
