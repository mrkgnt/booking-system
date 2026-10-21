import { Hono } from "hono";
import { getServiceRoleClient } from "../lib/supabase.js";
import { fetchTranslations, toLocaleMap } from "../lib/translations.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";

// Entity-type strings match the admin CRUD routes' own ENTITY_TYPE
// constants exactly (admin-service-categories.ts, admin-services.ts,
// admin-staff.ts) — not reinvented here.
const CATEGORY_ENTITY_TYPE = "service_category";
const SERVICE_ENTITY_TYPE = "service";
const STAFF_ENTITY_TYPE = "staff";

export const tenantInfoRoute = new Hono<{ Variables: TenantVariables }>();

// Resolves one translated field to a single string for `locale` — the
// widget needs one display string per field, not the full { locale: value }
// map every admin CRUD route returns (see translations.ts's toLocaleMap).
// Falls back to `defaultLocale` if `locale` is missing from the map, then
// to whichever locale IS present if even the default is missing. Kept
// module-local (not lib/) — only three call sites here, not worth
// promoting to a shared helper yet.
function resolveLocale(localeMap: Record<string, string>, locale: string, defaultLocale: string): string {
  if (localeMap[locale] !== undefined) return localeMap[locale];
  if (localeMap[defaultLocale] !== undefined) return localeMap[defaultLocale];
  const [firstAvailable] = Object.values(localeMap);
  return firstAvailable ?? "";
}

tenantInfoRoute.get("/public/tenant-info", tenantMiddleware, async (c) => {
  const tenant = c.get("tenant");
  const supabase = getServiceRoleClient(tenant);

  // .single() (not .maybeSingle()) matches availability.ts's existing
  // convention for this table — it's a true singleton row that must exist.
  const { data: businessProfile } = await supabase
    .from("business_profile")
    .select("name, theme_tokens, default_locale, supported_locales, status")
    .single();

  if (!businessProfile) {
    return c.json({ error: "internal_error" }, 500);
  }
  if (businessProfile.status !== "active") {
    return c.json({ error: "tenant_inactive" }, 404);
  }

  const defaultLocale = businessProfile.default_locale;
  const locale = c.req.query("locale") ?? defaultLocale;

  const [
    { data: categories, error: categoriesError },
    { data: services, error: servicesError },
    { data: staffRows, error: staffError },
    { data: staffServiceLinks, error: staffServicesError },
  ] = await Promise.all([
    supabase
      .from("service_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase.from("services").select("*").eq("is_active", true).order("display_order", { ascending: true }),
    supabase
      .from("staff")
      .select("*")
      .eq("is_active", true)
      .eq("is_bookable", true)
      .order("display_order", { ascending: true }),
    supabase.from("staff_services").select("*"),
  ]);

  if (categoriesError || servicesError || staffError || staffServicesError) {
    return c.json({ error: "internal_error" }, 500);
  }

  const [categoryTranslations, serviceTranslations, staffTranslations] = await Promise.all([
    Promise.all(
      (categories ?? []).map((category) => fetchTranslations(supabase, CATEGORY_ENTITY_TYPE, category.id)),
    ),
    Promise.all((services ?? []).map((service) => fetchTranslations(supabase, SERVICE_ENTITY_TYPE, service.id))),
    Promise.all((staffRows ?? []).map((member) => fetchTranslations(supabase, STAFF_ENTITY_TYPE, member.id))),
  ]);

  const serviceCategories = (categories ?? []).map((category, i) => ({
    id: category.id,
    icon: category.icon,
    displayOrder: category.display_order,
    name: resolveLocale(toLocaleMap(categoryTranslations[i], "name"), locale, defaultLocale),
  }));

  const serviceList = (services ?? []).map((service, i) => {
    const rows = serviceTranslations[i];
    return {
      id: service.id,
      categoryId: service.category_id,
      durationMinutes: service.duration_minutes,
      bufferMinutesBefore: service.buffer_minutes_before,
      bufferMinutesAfter: service.buffer_minutes_after,
      priceAmount: service.price_amount,
      priceCurrency: service.price_currency,
      pricePrefix: service.price_prefix,
      displayOrder: service.display_order,
      name: resolveLocale(toLocaleMap(rows, "name"), locale, defaultLocale),
      description: resolveLocale(toLocaleMap(rows, "description"), locale, defaultLocale),
    };
  });

  const staffList = (staffRows ?? []).map((member, i) => ({
    id: member.id,
    name: member.name, // plain column, not translated — no resolution needed
    photoUrl: member.photo_url,
    displayOrder: member.display_order,
    bio: resolveLocale(toLocaleMap(staffTranslations[i], "bio"), locale, defaultLocale),
  }));

  // staff_services is a pure join table with no is_active flag of its own —
  // filter to pairs whose staff/service both survived the active/bookable
  // filters above, so the widget never has to cross-reference a filtered-out
  // id.
  const activeServiceIds = new Set(serviceList.map((service) => service.id));
  const activeStaffIds = new Set(staffList.map((member) => member.id));
  const staffServices = (staffServiceLinks ?? [])
    .filter((link) => activeServiceIds.has(link.service_id) && activeStaffIds.has(link.staff_id))
    .map((link) => ({ staffId: link.staff_id, serviceId: link.service_id }));

  return c.json({
    tenant: {
      name: businessProfile.name,
      themeTokens: businessProfile.theme_tokens,
      defaultLocale: businessProfile.default_locale,
      supportedLocales: businessProfile.supported_locales,
    },
    serviceCategories,
    services: serviceList,
    staff: staffList,
    staffServices,
  });
});
