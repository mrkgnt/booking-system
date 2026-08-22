import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { deleteTranslations, fetchTranslations, toLocaleMap, upsertTranslations } from "../lib/translations.js";
import type { TypedSupabaseClient } from "../lib/supabase.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { createServiceSchema, serviceIdParamSchema, updateServiceSchema } from "./admin-services.schema.js";

const ENTITY_TYPE = "service";

function translationEntries(fields: { name?: Record<string, string>; description?: Record<string, string> }) {
  const entries: { locale: string; field: string; value: string }[] = [];
  for (const [locale, value] of Object.entries(fields.name ?? {})) {
    entries.push({ locale, field: "name", value });
  }
  for (const [locale, value] of Object.entries(fields.description ?? {})) {
    entries.push({ locale, field: "description", value });
  }
  return entries;
}

// Same { locale: value } shape on GET/POST/PATCH for both translated
// fields — mirrors admin-service-categories.ts's toLocaleMap usage.
async function withText<T extends { id: string }>(supabase: TypedSupabaseClient, service: T) {
  const rows = await fetchTranslations(supabase, ENTITY_TYPE, service.id);
  return { ...service, name: toLocaleMap(rows, "name"), description: toLocaleMap(rows, "description") };
}

export const adminServicesRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminServicesRoute.get("/admin/services", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const supabase = c.get("supabaseUser");
  const { data: services, error } = await supabase
    .from("services")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  const withTranslations = await Promise.all((services ?? []).map((service) => withText(supabase, service)));
  return c.json({ services: withTranslations });
});

adminServicesRoute.post("/admin/services", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createServiceSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: service, error } = await supabase
    .from("services")
    .insert({
      category_id: input.categoryId,
      duration_minutes: input.durationMinutes,
      buffer_minutes_before: input.bufferMinutesBefore,
      buffer_minutes_after: input.bufferMinutesAfter,
      price_amount: input.priceAmount,
      price_currency: input.priceCurrency,
      price_prefix: input.pricePrefix,
      display_order: input.displayOrder,
      is_active: input.isActive,
    })
    .select("*")
    .single();
  if (error || !service) {
    const { httpStatus, body } = classifySupabaseError(error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }
  await upsertTranslations(
    supabase,
    ENTITY_TYPE,
    service.id,
    translationEntries({ name: input.name, description: input.description }),
  );
  return c.json({ service: await withText(supabase, service) }, 201);
});

adminServicesRoute.patch("/admin/services/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = serviceIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = updateServiceSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: service, error } = await supabase
    .from("services")
    .update({
      ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
      ...(input.durationMinutes !== undefined ? { duration_minutes: input.durationMinutes } : {}),
      ...(input.bufferMinutesBefore !== undefined ? { buffer_minutes_before: input.bufferMinutesBefore } : {}),
      ...(input.bufferMinutesAfter !== undefined ? { buffer_minutes_after: input.bufferMinutesAfter } : {}),
      ...(input.priceAmount !== undefined ? { price_amount: input.priceAmount } : {}),
      ...(input.priceCurrency !== undefined ? { price_currency: input.priceCurrency } : {}),
      ...(input.pricePrefix !== undefined ? { price_prefix: input.pricePrefix } : {}),
      ...(input.displayOrder !== undefined ? { display_order: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq("id", parsedParams.data.id)
    .select("*")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!service) {
    return c.json({ error: "not_found" }, 404);
  }
  const entries = translationEntries({ name: input.name, description: input.description });
  if (entries.length > 0) {
    await upsertTranslations(supabase, ENTITY_TYPE, service.id, entries);
  }
  return c.json({ service: await withText(supabase, service) });
});

adminServicesRoute.delete("/admin/services/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = serviceIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: deleted, error } = await supabase
    .from("services")
    .delete()
    .eq("id", parsedParams.data.id)
    .select("id")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!deleted) {
    return c.json({ error: "not_found" }, 404);
  }
  await deleteTranslations(supabase, ENTITY_TYPE, parsedParams.data.id);
  return c.body(null, 204);
});
