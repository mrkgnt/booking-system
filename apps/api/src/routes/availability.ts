import { Hono } from "hono";
import { env } from "../config/env.js";
import { getServiceRoleClient } from "../lib/supabase.js";
import { computeAvailableSlots } from "../lib/availability.js";
import { zonedTimeToUtc } from "../lib/timezone.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { availabilityQuerySchema } from "./bookings.schema.js";

export const availabilityRoute = new Hono<{ Variables: TenantVariables }>();

availabilityRoute.get("/availability", tenantMiddleware, async (c) => {
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: c.req.query("service_id"),
    staffId: c.req.query("staff_id") || undefined,
    date: c.req.query("date"),
  });
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const { serviceId, staffId, date } = parsed.data;

  const tenant = c.get("tenant");
  const supabase = getServiceRoleClient(tenant);

  const [{ data: businessProfile }, { data: service, error: serviceError }] = await Promise.all([
    supabase.from("business_profile").select("timezone").single(),
    supabase
      .from("services")
      .select("id, duration_minutes, buffer_minutes_before, buffer_minutes_after, is_active")
      .eq("id", serviceId)
      .maybeSingle(),
  ]);

  if (serviceError || !service || !service.is_active) {
    return c.json({ error: "invalid_service" }, 422);
  }
  if (!businessProfile) {
    return c.json({ error: "internal_error" }, 500);
  }

  let candidateStaffIds: string[];
  if (staffId) {
    const { data: link } = await supabase
      .from("staff_services")
      .select("staff_id, staff:staff_id(is_active, is_bookable)")
      .eq("staff_id", staffId)
      .eq("service_id", serviceId)
      .maybeSingle();
    const staffRow = link?.staff as { is_active: boolean; is_bookable: boolean } | null | undefined;
    if (!link || !staffRow?.is_active || !staffRow?.is_bookable) {
      return c.json({ error: "invalid_service_staff_combination" }, 422);
    }
    candidateStaffIds = [staffId];
  } else {
    const { data: links } = await supabase
      .from("staff_services")
      .select("staff_id, staff:staff_id(is_active, is_bookable)")
      .eq("service_id", serviceId);
    candidateStaffIds = (links ?? [])
      .filter((l) => {
        const s = l.staff as { is_active: boolean; is_bookable: boolean } | null;
        return s?.is_active && s?.is_bookable;
      })
      .map((l) => l.staff_id);
  }

  if (candidateStaffIds.length === 0) {
    return c.json({ slots: [] });
  }

  const dayStartUtc = zonedTimeToUtc(date, "00:00", businessProfile.timezone);
  const dayEndUtc = zonedTimeToUtc(date, "23:59:59", businessProfile.timezone);

  const [{ data: businessHours }, { data: closures }, { data: existingBookings }] = await Promise.all([
    supabase
      .from("business_hours")
      .select("staff_id, day_of_week, opens_at, closes_at, is_closed")
      .or(`staff_id.is.null,staff_id.in.(${candidateStaffIds.join(",")})`),
    supabase
      .from("closures")
      .select("staff_id, starts_on, ends_on, is_recurring_yearly")
      .or(`staff_id.is.null,staff_id.in.(${candidateStaffIds.join(",")})`),
    supabase
      .from("bookings")
      .select("staff_id, starts_at, ends_at, services:service_id(buffer_minutes_before, buffer_minutes_after)")
      .in("staff_id", candidateStaffIds)
      .not("status", "in", "(cancelled,no_show)")
      .lte("starts_at", dayEndUtc.toISOString())
      .gte("ends_at", dayStartUtc.toISOString()),
  ]);

  const slots = computeAvailableSlots({
    date,
    timezone: businessProfile.timezone,
    serviceDurationMinutes: service.duration_minutes,
    bufferBeforeMinutes: service.buffer_minutes_before,
    bufferAfterMinutes: service.buffer_minutes_after,
    candidateStaffIds,
    businessHours: (businessHours ?? []).map((h) => ({
      staffId: h.staff_id,
      dayOfWeek: h.day_of_week,
      opensAt: h.opens_at,
      closesAt: h.closes_at,
      isClosed: h.is_closed,
    })),
    closures: (closures ?? []).map((cl) => ({
      staffId: cl.staff_id,
      startsOn: cl.starts_on,
      endsOn: cl.ends_on,
      isRecurringYearly: cl.is_recurring_yearly,
    })),
    existingBookings: (existingBookings ?? []).map((b) => {
      const svc = b.services as { buffer_minutes_before: number; buffer_minutes_after: number } | null;
      return {
        staffId: b.staff_id as string,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        bufferBeforeMinutes: svc?.buffer_minutes_before ?? 0,
        bufferAfterMinutes: svc?.buffer_minutes_after ?? 0,
      };
    }),
    slotGranularityMinutes: 15,
    minLeadMinutes: env.MIN_BOOKING_LEAD_MINUTES,
  });

  return c.json({ slots });
});
