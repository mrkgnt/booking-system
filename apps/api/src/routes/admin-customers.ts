import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { listCustomersQuerySchema, customerIdParamSchema, updateCustomerSchema } from "./admin-customers.schema.js";

export const adminCustomersRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminCustomersRoute.get("/admin/customers", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = listCustomersQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (parsed.data.q) {
    const q = parsed.data.q;
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  const { data: customers, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ customers: customers ?? [] });
});

adminCustomersRoute.get("/admin/customers/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = customerIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (!customer) {
    return c.json({ error: "not_found" }, 404);
  }
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("customer_id", parsedParams.data.id)
    .order("starts_at", { ascending: false });
  return c.json({ customer, bookings: bookings ?? [] });
});

adminCustomersRoute.patch("/admin/customers/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = customerIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = updateCustomerSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: updated, error } = await supabase
    .from("customers")
    .update(parsed.data)
    .eq("id", parsedParams.data.id)
    .select("*")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!updated) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ customer: updated });
});
