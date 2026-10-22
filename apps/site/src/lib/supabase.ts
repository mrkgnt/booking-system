import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// apps/site is a per-Tenant SSR deployment (output: "server") with its own
// Supabase credentials — but unlike apps/admin, it has no logged-in staff
// session to scope RLS to (every visitor is anonymous). apps/admin's own
// server client deliberately avoids the service-role key ("this app never
// uses the service-role key" — apps/admin/.env.example) because every read
// there IS scoped to a staff JWT. There's no equivalent user context here,
// so this instead mirrors apps/api's public routes (e.g. tenant-info.ts's
// getServiceRoleClient): a server-only secret-key client, never shipped to
// the browser since it's only ever constructed inside Astro SSR frontmatter.
//
// This also sidesteps a real gap: business_profile (read by getBusinessAddress
// below) has no `anon` GRANT in db/tenant-schema.sql — only the catalog
// tables (services/staff/business_hours/translations) and the new
// site_sections/site_content tables are anon-readable. ADR-0005 left
// "apps/site's own public read of site_content... direct Supabase REST +
// anon key... not fully settled, to be confirmed at /to-spec time" — this
// ticket had to pick something concrete to read the address at all, so it
// standardizes on the secret key for every apps/site read rather than
// mixing anon-key REST (for site_content) with a second, differently-keyed
// client just for business_profile. Flagging this as an open decision
// (CLAUDE.md's "flag open decisions rather than deciding silently"): revisit
// if a sibling Site Content ticket (#19/#20/#22/#23) settles on the anon-key
// pattern when this merges into site-cms-integration — it would mean either
// adding a scoped business_profile.address anon grant+policy, or keeping
// this secret-key client just for that one table.
let client: SupabaseClient | undefined;

export function getSiteSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.SUPABASE_URL;
    const key = import.meta.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set — see apps/site/.env.example");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
