/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Site Content CMS (ADR-0005, issue #22) — direct Supabase REST reads
  // with the anon key, matching apps/widget's/apps/admin's existing
  // public-read precedent, not proxied through apps/api.
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  // This Tenant's canonical/default locale — see .env.example for why
  // this is a build-time var rather than a live business_profile read.
  readonly SITE_CONTENT_CANONICAL_LOCALE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
