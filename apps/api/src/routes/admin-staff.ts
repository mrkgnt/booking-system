import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { deleteTranslations, fetchTranslations, toLocaleMap, upsertTranslations } from "../lib/translations.js";
import type { TypedSupabaseClient } from "../lib/supabase.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import {
  createStaffSchema,
  replaceStaffServicesSchema,
  staffIdParamSchema,
  updateStaffSchema,
} from "./admin-staff.schema.js";

const ENTITY_TYPE = "staff";

// Same { locale: value } shape on GET/POST/PATCH — mirrors
// admin-service-categories.ts's and admin-services.ts's toLocaleMap usage.
async function withBio<T extends { id: string }>(supabase: TypedSupabaseClient, member: T) {
  const rows = await fetchTranslations(supabase, ENTITY_TYPE, member.id);
  return { ...member, bio: toLocaleMap(rows, "bio") };
}

export const adminStaffRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminStaffRoute.get("/admin/staff", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const supabase = c.get("supabaseUser");
  const { data: staff, error } = await supabase
    .from("staff")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  const withTranslations = await Promise.all((staff ?? []).map((member) => withBio(supabase, member)));
  return c.json({ staff: withTranslations });
});

adminStaffRoute.post("/admin/staff", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createStaffSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: staffRow, error } = await supabase
    .from("staff")
    .insert({
      name: input.name,
      photo_url: input.photoUrl,
      display_order: input.displayOrder,
      is_active: input.isActive,
      is_bookable: input.isBookable,
    })
    .select("*")
    .single();
  if (error || !staffRow) {
    const { httpStatus, body } = classifySupabaseError(error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }
  if (input.bio) {
    await upsertTranslations(
      supabase,
      ENTITY_TYPE,
      staffRow.id,
      Object.entries(input.bio).map(([locale, value]) => ({ locale, field: "bio", value })),
    );
  }
  return c.json({ staff: await withBio(supabase, staffRow) }, 201);
});

adminStaffRoute.patch("/admin/staff/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = staffIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = updateStaffSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: staffRow, error } = await supabase
    .from("staff")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.photoUrl !== undefined ? { photo_url: input.photoUrl } : {}),
      ...(input.displayOrder !== undefined ? { display_order: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.isBookable !== undefined ? { is_bookable: input.isBookable } : {}),
    })
    .eq("id", parsedParams.data.id)
    .select("*")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!staffRow) {
    return c.json({ error: "not_found" }, 404);
  }
  if (input.bio) {
    await upsertTranslations(
      supabase,
      ENTITY_TYPE,
      staffRow.id,
      Object.entries(input.bio).map(([locale, value]) => ({ locale, field: "bio", value })),
    );
  }
  return c.json({ staff: await withBio(supabase, staffRow) });
});

adminStaffRoute.delete("/admin/staff/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = staffIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: deleted, error } = await supabase
    .from("staff")
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

adminStaffRoute.put("/admin/staff/:id/services", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = staffIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = replaceStaffServicesSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const staffId = parsedParams.data.id;

  const { error: deleteError } = await supabase.from("staff_services").delete().eq("staff_id", staffId);
  if (deleteError) {
    const { httpStatus, body } = classifySupabaseError(deleteError);
    return c.json(body, httpStatus as 409 | 500);
  }

  if (parsed.data.serviceIds.length === 0) {
    return c.json({ staffServices: [] });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("staff_services")
    .insert(parsed.data.serviceIds.map((serviceId) => ({ staff_id: staffId, service_id: serviceId })))
    .select("*");
  if (insertError) {
    const { httpStatus, body } = classifySupabaseError(insertError);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ staffServices: inserted ?? [] });
});
