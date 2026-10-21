// Client-side (browser) API layer for the Drawer's actual booking flow
// (issue #14): service → availability → contact info → double opt-in
// confirm, against apps/api's EXISTING /availability, /bookings,
// /bookings/confirm contract — reused unchanged, not reinvented here.
//
// Mirrors src/lib/api/tenant-info.ts's split: pure URL/payload builders get
// a vitest seam (test/lib/api/booking.test.ts); the actual networked fetch
// calls below have no dedicated unit test, by the same established
// precedent (tenant-info.ts's fetchTenantInfo has none either) — they're
// exercised live via Playwright E2E against the real Dent Di project. These
// run in the BROWSER (unlike tenant-info.ts's SSR-only fetchTenantInfo),
// since the booking flow is interactive post-load state the user drives
// inside the iframe — that's exactly what issue #14's wide-open CORS on
// these three routes (apps/api/src/app.ts) exists to allow.

export type AvailabilitySlot = {
  staffId: string;
  startsAt: string;
  endsAt: string;
};

// Pure — matches availability.ts's query schema: service_id/date required,
// staff_id optional. snake_case, NOT the camelCase the rest of this file
// uses — that's apps/api's existing query-param convention (see
// availability.ts), not something to "fix" here.
export function buildAvailabilityUrl(
  apiBaseUrl: string,
  params: { serviceId: string; date: string; staffId?: string },
): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const query = new URLSearchParams();
  query.set("service_id", params.serviceId);
  query.set("date", params.date);
  if (params.staffId) query.set("staff_id", params.staffId);
  return `${base}/availability?${query.toString()}`;
}

export type FetchAvailabilityResult =
  | { ok: true; slots: AvailabilitySlot[] }
  | { ok: false; error: string };

export async function fetchAvailability(
  apiBaseUrl: string,
  tenantSlug: string,
  params: { serviceId: string; date: string; staffId?: string },
): Promise<FetchAvailabilityResult> {
  try {
    const res = await fetch(buildAvailabilityUrl(apiBaseUrl, params), {
      headers: { "X-Tenant-Slug": tenantSlug },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: (body && body.error) || `http_${res.status}` };
    }
    return { ok: true, slots: (body?.slots ?? []) as AvailabilitySlot[] };
  } catch (err) {
    console.error(`[widget] GET /availability errored for tenant "${tenantSlug}":`, err);
    return { ok: false, error: "network_error" };
  }
}

export type BookingCustomerInput = {
  name: string;
  email?: string;
  phone?: string;
};

export type CreateBookingParams = {
  serviceId: string;
  staffId?: string;
  startsAt: string;
  locale: "lv" | "ru" | "en";
  customer: BookingCustomerInput;
  idempotencyKey: string;
};

// Pure — builds the exact POST /bookings body createBookingSchema expects
// (apps/api/src/routes/bookings.schema.ts). consentGiven is hardcoded true:
// this function is only ever called after the UI's own consent checkbox
// has been checked (enforced by the contact-form step, not here) — the
// server still re-validates it's literally `true` regardless.
export function buildCreateBookingPayload(params: CreateBookingParams): {
  serviceId: string;
  staffId?: string;
  startsAt: string;
  locale: "lv" | "ru" | "en";
  customer: { name: string; email: string | undefined; phone: string | undefined };
  consentGiven: true;
  idempotencyKey: string;
} {
  return {
    serviceId: params.serviceId,
    staffId: params.staffId,
    startsAt: params.startsAt,
    locale: params.locale,
    customer: {
      name: params.customer.name,
      email: params.customer.email,
      phone: params.customer.phone,
    },
    consentGiven: true,
    idempotencyKey: params.idempotencyKey,
  };
}

export type CreateBookingResult =
  | { ok: true; booking: Record<string, unknown>; devConfirmUrl?: string }
  | { ok: false; error: string };

export async function createBooking(
  apiBaseUrl: string,
  tenantSlug: string,
  params: CreateBookingParams,
): Promise<CreateBookingResult> {
  try {
    const base = apiBaseUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": tenantSlug },
      body: JSON.stringify(buildCreateBookingPayload(params)),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: (body && body.error) || `http_${res.status}` };
    }
    return { ok: true, booking: body.booking, devConfirmUrl: body._dev_confirm_url };
  } catch (err) {
    console.error(`[widget] POST /bookings errored for tenant "${tenantSlug}":`, err);
    return { ok: false, error: "network_error" };
  }
}

export type ConfirmBookingResult =
  | { ok: true; booking: Record<string, unknown> }
  | { ok: false; error: string };

export async function confirmBooking(
  apiBaseUrl: string,
  tenantSlug: string,
  token: string,
): Promise<ConfirmBookingResult> {
  try {
    const base = apiBaseUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/bookings/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": tenantSlug },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: (body && body.error) || `http_${res.status}` };
    }
    return { ok: true, booking: body.booking };
  } catch (err) {
    console.error(`[widget] POST /bookings/confirm errored for tenant "${tenantSlug}":`, err);
    return { ok: false, error: "network_error" };
  }
}
