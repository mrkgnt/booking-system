import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { deleteTranslations, fetchTranslations, toLocaleMap, upsertTranslations } from "../lib/translations.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import {
  categoryIdParamSchema,
  createServiceCategorySchema,
  updateServiceCategorySchema,
} from "./admin-service-categories.schema.js";

const ENTITY_TYPE = "service_category";

export const adminServiceCategoriesRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminServiceCategoriesRoute.get("/admin/service-categories", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const supabase = c.get("supabaseUser");
  const { data: categories, error } = await supabase
    .from("service_categories")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  const withNames = await Promise.all(
    (categories ?? []).map(async (category) => ({
      ...category,
      name: toLocaleMap(await fetchTranslations(supabase, ENTITY_TYPE, category.id), "name"),
    })),
  );
  return c.json({ serviceCategories: withNames });
});

adminServiceCategoriesRoute.post("/admin/service-categories", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createServiceCategorySchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: category, error } = await supabase
    .from("service_categories")
    .insert({
      icon: parsed.data.icon,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
    })
    .select("*")
    .single();
  if (error || !category) {
    const { httpStatus, body } = classifySupabaseError(error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }
  await upsertTranslations(
    supabase,
    ENTITY_TYPE,
    category.id,
    Object.entries(parsed.data.name).map(([locale, value]) => ({ locale, field: "name", value })),
  );
  return c.json({ serviceCategory: { ...category, name: parsed.data.name } }, 201);
});

adminServiceCategoriesRoute.patch(
  "/admin/service-categories/:id",
  tenantMiddleware,
  staffAuthMiddleware,
  async (c) => {
    const parsedParams = categoryIdParamSchema.safeParse({ id: c.req.param("id") });
    if (!parsedParams.success) {
      return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
    }
    const json = await c.req.json().catch(() => null);
    const parsed = updateServiceCategorySchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
    }
    const supabase = c.get("supabaseUser");
    const { icon, displayOrder, isActive, name } = parsed.data;
    const { data: category, error } = await supabase
      .from("service_categories")
      .update({
        ...(icon !== undefined ? { icon } : {}),
        ...(displayOrder !== undefined ? { display_order: displayOrder } : {}),
        ...(isActive !== undefined ? { is_active: isActive } : {}),
      })
      .eq("id", parsedParams.data.id)
      .select("*")
      .maybeSingle();
    if (error) {
      const { httpStatus, body } = classifySupabaseError(error);
      return c.json(body, httpStatus as 409 | 500);
    }
    if (!category) {
      return c.json({ error: "not_found" }, 404);
    }
    if (name) {
      await upsertTranslations(
        supabase,
        ENTITY_TYPE,
        category.id,
        Object.entries(name).map(([locale, value]) => ({ locale, field: "name", value })),
      );
    }
    // Always re-fetch rather than trust the request body: a PATCH that
    // didn't touch `name` still needs to return it, and this keeps the
    // response shape identical to GET/POST (see toLocaleMap in Task 4).
    const currentName = toLocaleMap(await fetchTranslations(supabase, ENTITY_TYPE, category.id), "name");
    return c.json({ serviceCategory: { ...category, name: currentName } });
  },
);

adminServiceCategoriesRoute.delete(
  "/admin/service-categories/:id",
  tenantMiddleware,
  staffAuthMiddleware,
  async (c) => {
    const parsedParams = categoryIdParamSchema.safeParse({ id: c.req.param("id") });
    if (!parsedParams.success) {
      return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
    }
    const supabase = c.get("supabaseUser");
    const { data: deleted, error } = await supabase
      .from("service_categories")
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
  },
);
