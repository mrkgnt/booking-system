import { env } from "./env.js";

// Minimal, env-var-driven tenant registry. There is exactly one client
// today (Dent Di) — a DB/KV-backed registry would be premature. The
// resolveTenant() signature below is the seam: when a real registry
// replaces this in-memory map (expected around the same time client #2
// forces the migration-runner question — see CLAUDE.md), only this file's
// internals change. Every caller (middleware, routes) is unaffected.
export type TenantConfig = {
  slug: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey: string;
};

const registry: Record<string, TenantConfig> = {
  dentdi: {
    slug: "dentdi",
    supabaseUrl: env.DENTDI_SUPABASE_URL,
    supabaseServiceRoleKey: env.DENTDI_SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: env.DENTDI_SUPABASE_ANON_KEY,
  },
};

export function resolveTenant(slug: string): TenantConfig | undefined {
  return registry[slug];
}
