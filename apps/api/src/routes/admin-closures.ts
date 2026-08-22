import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { closureIdParamSchema, createClosureSchema, listClosuresQuerySchema } from "./admin-closures.schema.js";

export const adminClosuresRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminClosuresRoute.get("/admin/closures", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = listClosuresQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  let query = supabase.from("closures").select("*").order("starts_on", { ascending: true });
  if (parsed.data.staffId) {
    query = query.eq("staff_id", parsed.data.staffId);
  }
  const { data: closures, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ closures: closures ?? [] });
});

adminClosuresRoute.post("/admin/closures", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createClosureSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: closure, error } = await supabase
    .from("closures")
    .insert({
      staff_id: input.staffId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      reason: input.reason,
      is_recurring_yearly: input.isRecurringYearly,
    })
    .select("*")
    .single();
  if (error || !closure) {
    const { httpStatus, body } = classifySupabaseError(error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ closure }, 201);
});

adminClosuresRoute.delete("/admin/closures/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = closureIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: deleted, error } = await supabase
    .from("closures")
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
  return c.body(null, 204);
});
