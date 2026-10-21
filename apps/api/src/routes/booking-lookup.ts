import { Hono } from "hono";
import { validateCapabilityToken } from "../lib/booking-tokens.js";
import { getServiceRoleClient } from "../lib/supabase.js";
import { fetchTranslations, toLocaleMap } from "../lib/translations.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { bookingLookupQuerySchema } from "./booking-lookup.schema.js";

const SERVICE_ENTITY_TYPE = "service";

// A single resolved string per field (not the full { locale: value } map
// admin CRUD routes return) — the widget's cancel/reschedule drawer wants
// to show one string in the customer's own locale, with the tenant's
// default_locale as a fallback when that locale's translation is missing.
function resolveLocaleString(map: Record<string, string>, locale: string, defaultLocale: string): string {
  return map[locale] ?? map[defaultLocale] ?? Object.values(map)[0] ?? "";
}

export const bookingLookupRoute = new Hono<{ Variables: TenantVariables }>();

// Read-only — the customer-facing read counterpart to /bookings/cancel and
// /bookings/reschedule. Deliberately does NOT reject on an already-finalized
// or already-passed booking the way those mutating endpoints do: the
// customer should still be able to see what happened to their booking (e.g.
// "this booking is already cancelled") even once they can no longer act on
// it. Only a genuinely invalid/expired token row blocks the read. Accepts
// either a cancel or a reschedule capability token for the same booking,
// since the widget's standalone cancel and reschedule pages each link here
// with whichever token their own confirmation email carried.
bookingLookupRoute.get("/public/bookings/lookup", tenantMiddleware, rateLimitMiddleware, async (c) => {
  const parsed = bookingLookupQuerySchema.safeParse({
    token: c.req.query("token"),
    locale: c.req.query("locale"),
  });
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }

  const tenant = c.get("tenant");
  const supabase = getServiceRoleClient(tenant);

  const result = await validateCapabilityToken(supabase, parsed.data.token, ["cancel", "reschedule"]);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }
  const booking = result.booking;

  const { data: businessProfile } = await supabase.from("business_profile").select("default_locale").single();
  const defaultLocale = businessProfile?.default_locale ?? "en";
  const locale = parsed.data.locale ?? defaultLocale;

  const { data: service } = await supabase
    .from("services")
    .select("id, duration_minutes")
    .eq("id", booking.service_id)
    .maybeSingle();

  const serviceTranslations = service ? await fetchTranslations(supabase, SERVICE_ENTITY_TYPE, service.id) : [];
  const nameMap = toLocaleMap(serviceTranslations, "name");
  const descriptionMap = toLocaleMap(serviceTranslations, "description");

  let staff: { name: string } | null = null;
  if (booking.staff_id) {
    const { data: staffRow } = await supabase
      .from("staff")
      .select("name")
      .eq("id", booking.staff_id)
      .maybeSingle();
    staff = staffRow ? { name: staffRow.name } : null;
  }

  return c.json({
    booking: {
      status: booking.status,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      service: {
        name: resolveLocaleString(nameMap, locale, defaultLocale),
        description: resolveLocaleString(descriptionMap, locale, defaultLocale),
        durationMinutes: service?.duration_minutes ?? null,
      },
      staff,
    },
  });
});
