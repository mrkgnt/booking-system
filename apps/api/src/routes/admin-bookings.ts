import { Hono } from "hono";
import { hasExistingConflict } from "../lib/booking-conflicts.js";
import type { Json } from "../lib/database.types.js";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { selectMatchingPatient, type PatientCandidate } from "../lib/patient-matching.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { bookingIdParamSchema, forceBookSchema, listBookingsQuerySchema } from "./admin-bookings.schema.js";

export const adminBookingsRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

const FINALIZED_STATUSES = ["cancelled", "completed", "no_show"] as const;

adminBookingsRoute.get("/admin/bookings", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = listBookingsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const { from, to, staffId, status } = parsed.data;

  const supabase = c.get("supabaseUser");
  let query = supabase.from("bookings").select("*").order("starts_at", { ascending: true });
  if (from) query = query.gte("starts_at", from);
  if (to) query = query.lte("starts_at", to);
  if (staffId) query = query.eq("staff_id", staffId);
  if (status) query = query.eq("status", status);

  const { data: bookings, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ bookings: bookings ?? [] });
});

adminBookingsRoute.post("/admin/bookings", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = forceBookSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const staffMember = c.get("staffMember");

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

  const conflict = await hasExistingConflict(supabase, input.staffId, startsAt, endsAt, service);
  if (conflict) {
    return c.json({ error: "slot_unavailable" }, 409);
  }

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
      staff_id: input.staffId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      locale: input.locale,
      description: input.description,
      status: "confirmed",
      source: "admin_manual",
      consent_given_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (bookingError || !booking) {
    const { httpStatus, body } = classifySupabaseError(bookingError ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }

  await supabase.from("audit_log").insert({
    actor_member_id: staffMember.id,
    action: "force_book",
    target_type: "booking",
    target_id: booking.id,
    before: null,
    after: booking as unknown as Json,
  });

  return c.json({ booking }, 201);
});

adminBookingsRoute.post("/admin/bookings/:id/cancel", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = bookingIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const staffMember = c.get("staffMember");

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (!booking) {
    return c.json({ error: "not_found" }, 404);
  }
  if (FINALIZED_STATUSES.includes(booking.status as (typeof FINALIZED_STATUSES)[number])) {
    return c.json({ error: "already_finalized" }, 409);
  }

  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: staffMember.id })
    .eq("id", booking.id)
    .select("*")
    .single();
  if (updateError || !updated) {
    const { httpStatus, body } = classifySupabaseError(updateError ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }

  await supabase.from("audit_log").insert({
    actor_member_id: staffMember.id,
    action: "staff_cancel",
    target_type: "booking",
    target_id: booking.id,
    before: booking as unknown as Json,
    after: updated as unknown as Json,
  });

  return c.json({ booking: updated });
});
