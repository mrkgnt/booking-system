import { Hono } from "hono";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";

export const adminMeRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminMeRoute.get("/admin/me", tenantMiddleware, staffAuthMiddleware, async (c) => {
  return c.json({ staffMember: c.get("staffMember") });
});
