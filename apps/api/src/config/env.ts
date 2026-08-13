import { z } from "zod";

// Single source of truth for process.env access — every other module should
// import `env` from here rather than touching process.env directly, so a
// missing var fails fast at boot with a clear message instead of surfacing
// as a confusing downstream Supabase/fetch error.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),

  // Per-tenant Supabase credentials. One block per client — see
  // tenant-registry.ts for how these are consumed. This naming convention
  // (TENANTSLUG_SUPABASE_*) is fine for a handful of clients; revisit once
  // a DB-backed tenant registry replaces this env-var map (see CLAUDE.md).
  DENTDI_SUPABASE_URL: z.string().url(),
  DENTDI_SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DENTDI_SUPABASE_ANON_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid/missing environment variables:\n${issues}\n\nSee .env.example.`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();
