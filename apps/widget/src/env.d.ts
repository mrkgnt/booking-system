/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  // apps/api base URL — build-time, same value for every tenant (unlike
  // the tenant slug itself, which is resolved per-request from the
  // embed snippet's data-tenant attribute, never from a build-time var).
  readonly API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
