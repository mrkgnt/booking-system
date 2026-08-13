import { Hono } from "hono";
import { env } from "../config/env.js";
import { getServiceRoleClient } from "../lib/supabase.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";

// Scaffold-only: proves the full header -> tenant -> service-role Supabase
// client -> real query path end-to-end, without touching booking logic or
// writing any data. Prod-gated below. Delete once booking-creation
// endpoints exist and prove the pipeline for real, or keep as a standing
// health-check-with-teeth — revisit once we're there (see CLAUDE.md).
export const smokeRoute = new Hono<{ Variables: TenantVariables }>();

smokeRoute.get("/_smoke/business-profile", tenantMiddleware, async (c) => {
  if (env.NODE_ENV === "production") {
    return c.notFound();
  }

  const tenant = c.get("tenant");
  const supabase = getServiceRoleClient(tenant);

  const { data, error } = await supabase
    .from("business_profile")
    .select("id, slug, default_locale, timezone")
    .limit(1)
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data);
});
