import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public, anon-key-scoped client for apps/site's direct Supabase REST reads
// (ADR-0005's "apps/site reads Site Content/staff directly, not proxied
// through apps/api" decision — the same "Public catalog reads" pattern
// services/staff/business_hours already use). No service-role key, no
// write path — only SELECT-granted, RLS-gated tables are reachable here.
//
// Deliberately untyped (no generated Database type import across apps,
// unlike apps/admin's lib/supabase/server.ts) — apps/site stays
// self-contained the same way apps/widget does (ADR-0004's rationale),
// and the two new tables this app reads (site_sections/site_content)
// aren't in apps/api's generated types yet anyway (pending the live
// migration's type regen).
export function getSupabaseAnonClient(): SupabaseClient {
  const url = import.meta.env.SUPABASE_URL;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}
