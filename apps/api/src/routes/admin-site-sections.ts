import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { siteSectionsQuerySchema } from "./admin-site-sections.schema.js";

export const adminSiteSectionsRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

// Read-only — no write path exists for this route at all (nor anywhere
// else in apps/api). site_sections is developer-owned per ADR-0005: adding
// or changing a Section is a code change (an Astro component plus a new
// row), never something a Tenant/staff member does through this API.
adminSiteSectionsRoute.get("/admin/site-sections", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = siteSectionsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: sections, error } = await supabase
    .from("site_sections")
    .select("*")
    .eq("page_slug", parsed.data.page)
    .order("display_order", { ascending: true });
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ sections: sections ?? [] });
});
