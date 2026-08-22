import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { businessHoursQuerySchema, replaceBusinessHoursSchema } from "./admin-business-hours.schema.js";

export const adminBusinessHoursRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminBusinessHoursRoute.get("/admin/business-hours", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = businessHoursQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  let query = supabase.from("business_hours").select("*").order("day_of_week", { ascending: true });
  query = parsed.data.staffId ? query.eq("staff_id", parsed.data.staffId) : query.is("staff_id", null);
  const { data: hours, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ businessHours: hours ?? [] });
});

adminBusinessHoursRoute.put("/admin/business-hours", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = replaceBusinessHoursSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { staffId, hours } = parsed.data;

  let deleteQuery = supabase.from("business_hours").delete();
  deleteQuery = staffId ? deleteQuery.eq("staff_id", staffId) : deleteQuery.is("staff_id", null);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    const { httpStatus, body } = classifySupabaseError(deleteError);
    return c.json(body, httpStatus as 409 | 500);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("business_hours")
    .insert(
      hours.map((h) => ({
        staff_id: staffId,
        day_of_week: h.dayOfWeek,
        opens_at: h.opensAt,
        closes_at: h.closesAt,
        is_closed: h.isClosed,
      })),
    )
    .select("*");
  if (insertError) {
    const { httpStatus, body } = classifySupabaseError(insertError);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ businessHours: inserted ?? [] });
});
