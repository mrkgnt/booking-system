import type { MiddlewareHandler } from "hono";
import { getServiceRoleClient, getUserScopedClient, type TypedSupabaseClient } from "../lib/supabase.js";
import type { TenantVariables } from "./tenant.js";

export type StaffAuthVariables = {
  staffMember: { id: string; userId: string; roleKey: string };
  supabaseUser: TypedSupabaseClient;
};

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

// Validates the caller's Supabase Auth session, then confirms active
// business_members status before letting any /admin/* handler run.
//
// The membership lookup deliberately uses the service-role client, which
// bypasses RLS — is_active_member() (see db/tenant-schema.sql) gates the
// "members access X" policies on bm.status = 'active', so an
// invited-or-disabled member can never read their OWN business_members row
// through the RLS-scoped client: every query would just come back empty.
// Without this one privileged read, a disabled member would get confusing
// empty results on every route instead of a clean 403.
//
// Every actual data query in /admin/* routes uses the user-scoped client
// set here (c.get("supabaseUser")), not this middleware's service-role
// client — RLS stays the real authorization boundary for everything after
// this middleware runs.
export const staffAuthMiddleware: MiddlewareHandler<{
  Variables: TenantVariables & StaffAuthVariables;
}> = async (c, next) => {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const tenant = c.get("tenant");
  const supabaseUser = getUserScopedClient(tenant, token);

  const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
  if (userError || !userData.user) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const serviceClient = getServiceRoleClient(tenant);
  const { data: member } = await serviceClient
    .from("business_members")
    .select("id, status, roles:role_id(key)")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  const roleKey = (member?.roles as { key: string } | null)?.key;
  if (!member || member.status !== "active" || !roleKey) {
    return c.json({ error: "not_authorized" }, 403);
  }

  c.set("staffMember", { id: member.id, userId: userData.user.id, roleKey });
  c.set("supabaseUser", supabaseUser);
  await next();
};
