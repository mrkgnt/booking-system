import type { MiddlewareHandler } from "hono";
import { resolveTenant, type TenantConfig } from "../config/tenant-registry.js";

export type TenantVariables = {
  tenant: TenantConfig;
};

// Resolves the tenant from an X-Tenant-Slug header. Interim mechanism —
// header-based rather than hostname-based, since there's no second real
// client domain yet to prove hostname routing against (see CLAUDE.md).
// No silent default-tenant fallback: a missing/unknown slug is a hard
// 400/404, not "assume Dent Di."
export const tenantMiddleware: MiddlewareHandler<{ Variables: TenantVariables }> = async (
  c,
  next,
) => {
  const slug = c.req.header("X-Tenant-Slug");
  if (!slug) {
    return c.json({ error: "X-Tenant-Slug header is required" }, 400);
  }

  const tenant = resolveTenant(slug);
  if (!tenant) {
    return c.json({ error: `Unknown tenant: ${slug}` }, 404);
  }

  c.set("tenant", tenant);
  await next();
};
