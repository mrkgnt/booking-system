import { Hono } from "hono";
import { resolveCustomerLabel } from "../lib/customer-label.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";

export const adminMeRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminMeRoute.get("/admin/me", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const supabase = c.get("supabaseUser");
  const { data: businessProfile } = await supabase
    .from("business_profile")
    .select("site_config")
    .maybeSingle();

  return c.json({
    staffMember: c.get("staffMember"),
    customerLabel: resolveCustomerLabel(businessProfile?.site_config),
  });
});
