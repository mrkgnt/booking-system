import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TenantConfig } from "../config/tenant-registry.js";
import type { Database } from "./database.types.js";

// Both factories take a TenantConfig explicitly rather than reading env vars
// directly, so no code path can accidentally use the wrong tenant's key.
// Typed against the generated Database schema (see database.types.ts) so
// every .from(...).select(...) call is checked against real table/column
// names instead of hand-typed guesses.
export type TypedSupabaseClient = SupabaseClient<Database>;

// getServiceRoleClient bypasses RLS entirely — this is the client
// booking-write endpoints use. Per PROJECT_CONTEXT.md: tenant correctness
// on that path is enforced ENTIRELY by which TenantConfig gets passed in
// here, not by Postgres. This is the single most important place for a
// routing bug to matter.
export function getServiceRoleClient(tenant: TenantConfig): TypedSupabaseClient {
  return createClient<Database>(tenant.supabaseUrl, tenant.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

// Not used by any route yet — included for parity/future use once a route
// needs to exercise the same RLS-scoped path the public widget uses.
export function getAnonClient(tenant: TenantConfig): TypedSupabaseClient {
  return createClient<Database>(tenant.supabaseUrl, tenant.supabaseAnonKey, {
    auth: { persistSession: false },
  });
}
