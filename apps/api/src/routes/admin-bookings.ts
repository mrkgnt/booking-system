import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { listBookingsQuerySchema } from "./admin-bookings.schema.js";

export const adminBookingsRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

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
