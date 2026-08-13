import { Hono } from "hono";
import { env } from "../config/env.js";
import { getServiceRoleClient } from "../lib/supabase.js";
import { hasBufferConflict } from "../lib/availability.js";
import { selectMatchingPatient, type PatientCandidate } from "../lib/patient-matching.js";
import { classifySupabaseError, isIdempotencyKeyViolation } from "../lib/pg-errors.js";
import { generateRawToken, hashToken } from "../lib/tokens.js";
import { sendVerificationLink } from "../lib/notifications.js";
import { verifyTurnstileToken } from "../lib/turnstile.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { confirmBookingSchema, createBookingSchema } from "./bookings.schema.js";

export const bookingsRoute = new Hono<{ Variables: TenantVariables }>();

bookingsRoute.post("/bookings", tenantMiddleware, rateLimitMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;

  const turnstileOk = await verifyTurnstileToken(input.turnstileToken);
  if (!turnstileOk) {
    return c.json({ error: "bot_verification_failed" }, 400);
  }

  const tenant = c.get("tenant");
  const supabase = getServiceRoleClient(tenant);

  // Idempotency replay check first — if this exact key was already used,
  // return the existing booking (200, success path) before doing any other
  // work. Cheaper than racing to insert-and-catch for the common retry case.
  const { data: existingByKey } = await supabase
    .from("bookings")
    .select("*")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existingByKey) {
    return c.json({ booking: existingByKey }, 200);
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, duration_minutes, buffer_minutes_before, buffer_minutes_after, is_active")
    .eq("id", input.serviceId)
    .maybeSingle();
  if (serviceError || !service || !service.is_active) {
    return c.json({ error: "invalid_service" }, 422);
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);

  let staffId = input.staffId;
  if (staffId) {
    const { data: link } = await supabase
      .from("staff_services")
      .select("staff_id, staff:staff_id(is_active, is_bookable)")
      .eq("staff_id", staffId)
      .eq("service_id", input.serviceId)
      .maybeSingle();
    const staffRow = link?.staff as { is_active: boolean; is_bookable: boolean } | null | undefined;
    if (!link || !staffRow?.is_active || !staffRow?.is_bookable) {
      return c.json({ error: "invalid_service_staff_combination" }, 422);
    }
  } else {
    // "Any eligible staff": pick the first eligible staff member who is
    // actually free at the exact requested interval.
    const { data: links } = await supabase
      .from("staff_services")
      .select("staff_id, staff:staff_id(is_active, is_bookable)")
      .eq("service_id", input.serviceId);
    const eligibleStaffIds = (links ?? [])
      .filter((l) => {
        const s = l.staff as { is_active: boolean; is_bookable: boolean } | null;
        return s?.is_active && s?.is_bookable;
      })
      .map((l) => l.staff_id);

    for (const candidateStaffId of eligibleStaffIds) {
      const conflict = await hasExistingConflict(supabase, candidateStaffId, startsAt, endsAt, service);
      if (!conflict) {
        staffId = candidateStaffId;
        break;
      }
    }
    if (!staffId) {
      return c.json({ error: "slot_unavailable" }, 409);
    }
  }

  // Re-validate the specific slot is still open immediately before insert.
  // The DB's exclusion constraint (bookings_no_overlap) is the real
  // backstop for the exact-overlap race, but it isn't buffer-aware — this
  // app-level check is what actually enforces buffer gaps.
  const conflict = await hasExistingConflict(supabase, staffId, startsAt, endsAt, service);
  if (conflict) {
    return c.json({ error: "slot_unavailable" }, 409);
  }

  // Patient find-or-create.
  const orFilters = [
    input.patient.email ? `email.eq.${input.patient.email}` : null,
    input.patient.phone ? `phone.eq.${input.patient.phone}` : null,
  ].filter((f): f is string => f !== null);
  const { data: candidateRows } = await supabase
    .from("patients")
    .select("id, email, phone, created_at")
    .or(orFilters.join(","));
  const candidates: PatientCandidate[] = (candidateRows ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    phone: p.phone,
    createdAt: p.created_at,
  }));
  const matchedPatient = selectMatchingPatient(candidates, {
    email: input.patient.email,
    phone: input.patient.phone,
  });

  let patientId: string;
  if (matchedPatient) {
    patientId = matchedPatient.id;
  } else {
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({
        name: input.patient.name,
        email: input.patient.email,
        phone: input.patient.phone,
        preferred_locale: input.locale,
      })
      .select("id")
      .single();
    if (patientError || !newPatient) {
      const { httpStatus, body } = classifySupabaseError(patientError ?? {});
      return c.json(body, httpStatus as 409 | 500);
    }
    patientId = newPatient.id;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      patient_id: patientId,
      service_id: input.serviceId,
      staff_id: staffId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      locale: input.locale,
      description: input.description,
      status: "pending_verification",
      source: "public",
      idempotency_key: input.idempotencyKey,
      consent_given_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (bookingError || !booking) {
    if (isIdempotencyKeyViolation(bookingError ?? {})) {
      const { data: raceWinner } = await supabase
        .from("bookings")
        .select("*")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (raceWinner) {
        return c.json({ booking: raceWinner }, 200);
      }
    }
    const { httpStatus, body } = classifySupabaseError(bookingError ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.VERIFICATION_TOKEN_TTL_MINUTES * 60_000);

  await supabase.from("booking_verification_tokens").insert({
    booking_id: booking.id,
    purpose: "confirm",
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  const confirmUrl = `${env.NODE_ENV === "production" ? "" : "http://localhost:" + env.PORT}/bookings/confirm?token=${rawToken}`;
  const channel: "email" | "sms" = input.patient.email ? "email" : "sms";
  const to = input.patient.email ?? input.patient.phone ?? "";

  const sendResult = await sendVerificationLink({ channel, to, confirmUrl, locale: input.locale });

  await supabase.from("notification_log").insert({
    booking_id: booking.id,
    channel,
    template: "double_opt_in",
    locale: input.locale,
    status: sendResult.status === "sent" ? "sent" : "pending",
    provider_message_id: sendResult.providerMessageId,
    error: sendResult.error,
  });

  const responseBody: Record<string, unknown> = { booking };
  if (env.NODE_ENV !== "production") {
    responseBody._dev_confirm_url = confirmUrl;
  }

  return c.json(responseBody, 201);
});

bookingsRoute.post("/bookings/confirm", tenantMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = confirmBookingSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }

  const tenant = c.get("tenant");
  const supabase = getServiceRoleClient(tenant);
  const tokenHash = hashToken(parsed.data.token);

  const { data: tokenRow } = await supabase
    .from("booking_verification_tokens")
    .select("id, booking_id, expires_at, used_at, purpose")
    .eq("token_hash", tokenHash)
    .eq("purpose", "confirm")
    .maybeSingle();

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    return c.json({ error: "invalid_or_expired_token" }, 400);
  }

  const { data: booking, error: updateError } = await supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", tokenRow.booking_id)
    .select("*")
    .single();

  if (updateError || !booking) {
    const { httpStatus, body } = classifySupabaseError(updateError ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }

  await supabase
    .from("booking_verification_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return c.json({ booking });
});

async function hasExistingConflict(
  supabase: ReturnType<typeof getServiceRoleClient>,
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  service: { buffer_minutes_before: number; buffer_minutes_after: number },
): Promise<boolean> {
  const bufferMs = 24 * 60 * 60_000; // widen the query window by a day either side to safely catch buffer-adjacent bookings
  const { data: nearby } = await supabase
    .from("bookings")
    .select("starts_at, ends_at, services:service_id(buffer_minutes_before, buffer_minutes_after)")
    .eq("staff_id", staffId)
    .not("status", "in", "(cancelled,no_show)")
    .gte("starts_at", new Date(startsAt.getTime() - bufferMs).toISOString())
    .lte("starts_at", new Date(endsAt.getTime() + bufferMs).toISOString());

  return hasBufferConflict(
    {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      bufferBeforeMinutes: service.buffer_minutes_before,
      bufferAfterMinutes: service.buffer_minutes_after,
    },
    (nearby ?? []).map((b) => {
      const svc = b.services as { buffer_minutes_before: number; buffer_minutes_after: number } | null;
      return {
        staffId,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        bufferBeforeMinutes: svc?.buffer_minutes_before ?? 0,
        bufferAfterMinutes: svc?.buffer_minutes_after ?? 0,
      };
    }),
  );
}
