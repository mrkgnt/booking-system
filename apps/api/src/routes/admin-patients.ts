import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { listPatientsQuerySchema, patientIdParamSchema, updatePatientSchema } from "./admin-patients.schema.js";

export const adminPatientsRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminPatientsRoute.get("/admin/patients", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = listPatientsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  let query = supabase.from("patients").select("*").order("created_at", { ascending: false });
  if (parsed.data.q) {
    const q = parsed.data.q;
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  const { data: patients, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ patients: patients ?? [] });
});

adminPatientsRoute.get("/admin/patients/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = patientIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (!patient) {
    return c.json({ error: "not_found" }, 404);
  }
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("patient_id", parsedParams.data.id)
    .order("starts_at", { ascending: false });
  return c.json({ patient, bookings: bookings ?? [] });
});

adminPatientsRoute.patch("/admin/patients/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = patientIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = updatePatientSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: updated, error } = await supabase
    .from("patients")
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
  return c.json({ patient: updated });
});
