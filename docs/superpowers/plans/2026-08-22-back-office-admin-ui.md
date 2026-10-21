# Back Office Admin UI — Foundation + Bookings Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the first slice of a staff-facing "back office" — a new `apps/admin` Astro app with Supabase-Auth-based login (SSR session, no Hono login endpoint) and a working Bookings screen (list + filters, force-book, cancel, reschedule) against the already-built `apps/api` admin routes.

**Non-goals for this plan (explicitly deferred, not silently dropped):** a calendar *view* of bookings (list view only this pass — `PROJECT_CONTEXT.md` asks for "calendar + list views," this plan ships the list half); Patients/clientele UI; Catalog CRUD UI (service categories, services, staff, business hours, closures); Paytraq receipt UI (backend integration isn't wired up at all yet — schema-only stub). Each of those becomes its own follow-up plan reusing this plan's foundation (auth, layout, API client pattern).

**Architecture:** `apps/admin` is a server-rendered (`output: "server"`) Astro app — Astro owns routing/layout, React owns the interactive islands (the bookings table, filters, and forms, hydrated with `client:load`). Astro SSR middleware validates the staff member's Supabase session on every request via `@supabase/ssr` and redirects to `/login` if missing; there is no Hono login endpoint — the login page calls `supabase-js`'s `signInWithPassword` directly, exactly as `CLAUDE.md`'s existing admin/staff data-access decision specifies. Once authenticated, Astro pages read the session server-side and pass the raw access token down to React islands as a prop; islands call `apps/api`'s `/admin/*` routes directly (cross-origin, hence this plan's CORS task) with `Authorization: Bearer <token>` + `X-Tenant-Slug: dentdi`. Visual design is a distinct neutral/utilitarian admin theme (Tailwind CSS defaults, system sans-serif) — deliberately not the Dent Di public-site brand (sage/cream/Georgia serif), which is reserved for the future public marketing site.

**Tech Stack:** Astro 5 (`output: "server"`, `@astrojs/node` adapter — a placeholder mirroring `apps/api`'s still-open hosting decision), `@astrojs/react`, React 19, Tailwind CSS v4 via `@tailwindcss/vite` (the current officially-recommended path — `@astrojs/tailwind` is deprecated), `@supabase/supabase-js` + `@supabase/ssr`, Vitest, pnpm workspaces.

**Spec:** `PROJECT_CONTEXT.md` (`## Admin/Staff-Facing Backend — Must Support`, `## Internationalization (i18n)`) and `CLAUDE.md` (Decisions Log — "Admin/staff data-access pattern"; the "Staff/admin backend built" checklist entry documenting every `/admin/*` route this plan's UI consumes). No new spec doc — these two files are the project's living spec, same as the prior `docs/superpowers/plans/2026-08-22-staff-admin-backend.md` plan that built the API this one consumes.

## Global Constraints

- Tenant is hardcoded to `dentdi` for this plan (`X-Tenant-Slug: dentdi`) — the platform's tenant-registry is still an interim, header-based, single-project mechanism per `CLAUDE.md`'s Decisions Log; this app is single-tenant-per-deployment in practice.
- Locales: `"lv" | "ru" | "en"` — matches the existing `bookings.locale` enum and `business_profile.supported_locales`.
- Every `/admin/*` request needs two headers: `X-Tenant-Slug` and `Authorization: Bearer <supabase-access-token>` — no code path in this plan calls `apps/api` without both.
- No service-role key anywhere in `apps/admin` — only the anon key, used exclusively for `signInWithPassword`/session management via `@supabase/ssr`. All actual data access goes through `apps/api`'s RLS-scoped `/admin/*` routes, never direct Supabase queries from the admin app.
- Translated fields (`services.name`/`description`, `staff.bio`) round-trip as `Record<locale, string>` on both request and response bodies — this plan's catalog reads (services/staff dropdowns) must handle that shape, not assume a plain string column.
- `db/tenant-schema.sql`/`database.types.ts` stay the source of truth for row shapes — `apps/admin` imports `Database` via a type-only relative import from `apps/api/src/lib/database.types.ts` rather than duplicating or hand-typing rows.
- Run `pnpm --filter @booking-system/api test`, `pnpm --filter @booking-system/api typecheck`, `pnpm --filter @booking-system/admin test`, `pnpm --filter @booking-system/admin typecheck` after every task that touches the relevant package; all must be clean before moving on.
- Steps marked **LIVE** require the real Dent Di Supabase project and must be run against it (via Supabase MCP tools for SQL, and a real browser for anything auth/session-related) — not fakeable with mocks, same convention the prior plan used for its LIVE steps.

---

## Task 1: Bootstrap the Dent Di owner account

**Files:** None — live data setup, not a code change.

**Interfaces:** Produces a real `auth.users` row (email `owner@dentdi.lv`) + a `business_members` row (`role_id → owner`, `status = 'active'`). Every later task's manual-verification step logs in as this account.

**Honesty check on automatability:** confirmed via Supabase MCP (`list_extensions`/`list_tables`/`execute_sql`, read-only) that `pgcrypto` is installed on the live Dent Di project and `auth.users` currently has 0 rows — this account genuinely doesn't exist yet. There is no dedicated "create auth user" MCP tool in the `mcp__claude_ai_Supabase__*` set — only `execute_sql`/`apply_migration` (raw SQL) and read tools. Creating the actual Auth user is either a human-run local step (Path A, officially supported — GoTrue owns every internal invariant) or an MCP-executable but unsupported SQL workaround (Path B). **Default to Path A; only use Path B if execution happens in a sandbox with no `*.supabase.co` egress and Path A genuinely can't be run**, and verify it worked via Task 7's login page before trusting it.

- [ ] **Step 1a — Path A (preferred, run locally, not in a network-restricted sandbox): create the user via the Auth Admin API**

```bash
cd apps/api && set -a; source .env; set +a

curl -s -X POST "$DENTDI_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $DENTDI_SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $DENTDI_SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@dentdi.lv","password":"REPLACE-WITH-A-STRONG-PASSWORD","email_confirm":true}'
```

Expected: `201`, body includes `"id"` — save it as `OWNER_USER_ID`.

- [ ] **Step 1b — Path B (fallback only, MCP-executable from a sandboxed session, unsupported/fragile):** via Supabase MCP `execute_sql` against project `eafeskigfcinnwahjiyx`. Flag this explicitly to whoever's running the plan before executing it — this bypasses GoTrue's own validation logic. Verify it actually works by logging in through Task 7's login page afterward; fall back to Path A if it doesn't.

```sql
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'owner@dentdi.lv', crypt('REPLACE-WITH-A-STRONG-PASSWORD', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) returning id;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email = 'owner@dentdi.lv';
```

- [ ] **Step 2 — Insert the `business_members` row (MCP-executable, genuinely automatable):**

```sql
insert into business_members (user_id, role_id, status)
select '<OWNER_USER_ID>', id, 'active' from roles where key = 'owner';
```

Expected: 1 row inserted.

- [ ] **Step 3 — Verify (read-only via Supabase MCP `execute_sql`):**

```sql
select bm.status, r.key as role_key from business_members bm
join roles r on r.id = bm.role_id where bm.user_id = '<OWNER_USER_ID>';
```

Expected: one row, `status = 'active'`, `role_key = 'owner'`. (Obtaining an actual session token is deferred to Task 7's manual-verification step — logging in through the real login page in a browser is the natural place to prove this account works end to end.)

No commit — no code changed.

---

## Task 2: Add CORS middleware to `apps/api`

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/.env.example`
- Test: `apps/api/test/cors.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: an `ADMIN_APP_ORIGIN`-gated CORS layer on `/admin/*`. Every later task that has the browser call `apps/api` directly depends on this.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/cors.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("CORS on /admin/*", () => {
  it("reflects the configured admin origin on a preflight request", async () => {
    const res = await app.request("/admin/me", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:4321", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:4321");
  });

  it("does not add CORS headers for a disallowed origin", async () => {
    const res = await app.request("/admin/me", {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example.com", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/cors.test.ts`
Expected: FAIL — no CORS headers exist yet (both assertions fail, since the middleware isn't there).

- [ ] **Step 3: Implement**

In `apps/api/src/config/env.ts`, add to `envSchema` (alongside the other tunables):

```typescript
  ADMIN_APP_ORIGIN: z.string().url().default("http://localhost:4321"),
```

In `apps/api/src/app.ts`, add the import and register the middleware before the route registrations:

```typescript
import { cors } from "hono/cors";
import { env } from "./config/env.js";
```

```typescript
app.use(
  "/admin/*",
  cors({
    origin: env.ADMIN_APP_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization", "X-Tenant-Slug"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);
```

(`hono/cors` is a subpath of the already-installed `hono` package — confirmed present at `node_modules/hono/dist/middleware/cors`, no new dependency needed.) Place this `app.use` call immediately after `export const app = new Hono();`, before any `app.route(...)` calls.

Add to `apps/api/.env.example`:

```
ADMIN_APP_ORIGIN=http://localhost:4321
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/cors.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean, 104/104 (102 pre-existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/src/app.ts apps/api/.env.example apps/api/test/cors.test.ts
git commit -m "feat(api): add CORS middleware for the admin app origin"
```

---

## Task 3: Scaffold `apps/admin` (Astro + Tailwind v4 + React + nav shell)

**Files:**
- Create: `apps/admin/package.json`, `apps/admin/astro.config.mjs`, `apps/admin/tsconfig.json`
- Create: `apps/admin/src/env.d.ts`, `apps/admin/src/styles/global.css`
- Create: `apps/admin/src/layouts/AdminLayout.astro`
- Create: `apps/admin/src/pages/index.astro`, `apps/admin/src/pages/bookings.astro` (stub, replaced in Task 10)

**Interfaces:**
- Consumes: nothing new.
- Produces: a runnable `pnpm --filter @booking-system/admin dev` app on `:4321` with a nav shell (Bookings link functional; Patients/Catalog/Scheduling present but disabled — placeholders for future plans). Every later task builds inside this scaffold.

- [ ] **Step 1: Create the package manifest**

Create `apps/admin/package.json`:

```json
{
  "name": "@booking-system/admin",
  "private": true,
  "type": "module",
  "description": "Staff-facing back office admin UI (Astro + React islands) — talks to apps/api's /admin/* routes.",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "astro check && tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "astro": "^5.9.0",
    "@astrojs/react": "^4.2.0",
    "@astrojs/node": "^9.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.4",
    "@supabase/ssr": "^0.5.2"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.7.3",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Install**

Run: `pnpm install` from the repo root. `pnpm-workspace.yaml`'s `apps/*` glob picks up the new package automatically — no workspace config change needed.

- [ ] **Step 3: Astro config**

Create `apps/admin/astro.config.mjs`:

```javascript
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// SSR (not static) — src/middleware.ts (Task 6) must run on every request.
// Node adapter is a placeholder, same open question as apps/api's hosting
// (Workers vs. Vercel) — revisit together once that's decided.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
```

- [ ] **Step 4: TypeScript config**

Create `apps/admin/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*", "../api/src/lib/database.types.ts"],
  "exclude": ["dist"],
  "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "react" }
}
```

- [ ] **Step 5: Env/Locals types**

Create `apps/admin/src/env.d.ts`:

```typescript
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type StaffSession = { accessToken: string; user: { id: string; email: string } };

declare namespace App {
  interface Locals {
    session: StaffSession | null;
  }
}
```

- [ ] **Step 6: Global stylesheet**

Create `apps/admin/src/styles/global.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 7: Base layout with nav shell**

Create `apps/admin/src/layouts/AdminLayout.astro`:

```astro
---
import "../styles/global.css";
interface Props { title: string }
const { title } = Astro.props;
const navItems = [
  { href: "/bookings", label: "Bookings", enabled: true },
  { href: "/patients", label: "Patients", enabled: false },
  { href: "/catalog", label: "Catalog", enabled: false },
  { href: "/scheduling", label: "Scheduling", enabled: false },
];
const currentPath = Astro.url.pathname;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} — Dent Di Back Office</title>
  </head>
  <body class="min-h-screen bg-gray-50 text-gray-900 antialiased">
    <div class="flex min-h-screen">
      <nav class="w-56 shrink-0 border-r border-gray-200 bg-white p-4">
        <p class="mb-6 text-sm font-semibold uppercase tracking-wide text-gray-400">Dent Di</p>
        <ul class="space-y-1">
          {navItems.map((item) => (
            <li>
              {item.enabled ? (
                <a href={item.href}
                   class={`block rounded px-3 py-2 text-sm font-medium ${currentPath.startsWith(item.href) ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}>
                  {item.label}
                </a>
              ) : (
                <span class="block cursor-not-allowed rounded px-3 py-2 text-sm text-gray-300">
                  {item.label} <span class="text-xs">(soon)</span>
                </span>
              )}
            </li>
          ))}
        </ul>
        <form method="POST" action="/api/auth/logout" class="mt-8">
          <button type="submit" class="text-sm text-gray-500 hover:text-gray-800">Log out</button>
        </form>
      </nav>
      <main class="flex-1 p-8">
        <h1 class="mb-6 text-xl font-semibold">{title}</h1>
        <slot />
      </main>
    </div>
  </body>
</html>
```

- [ ] **Step 8: Root redirect**

Create `apps/admin/src/pages/index.astro`:

```astro
---
return Astro.redirect("/bookings");
---
```

- [ ] **Step 9: Bookings page stub** (fully replaced in Task 10)

Create `apps/admin/src/pages/bookings.astro`:

```astro
---
import AdminLayout from "../layouts/AdminLayout.astro";
---
<AdminLayout title="Bookings"><p>Bookings screen coming in Task 10.</p></AdminLayout>
```

- [ ] **Step 10: Manual verification**

Run: `pnpm --filter @booking-system/admin dev`, open `http://localhost:4321`.
Expected: redirects to `/bookings`; nav shows "Bookings" highlighted active and "Patients"/"Catalog"/"Scheduling" grayed out with "(soon)".

- [ ] **Step 11: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): scaffold apps/admin — Astro, Tailwind v4, React integration, nav shell"
```

---

## Task 4: Supabase server client + database-types wiring

**Files:**
- Create: `apps/admin/src/lib/supabase/server.ts`
- Create: `apps/admin/.env.example`

**Interfaces:**
- Consumes: `Database` (type-only, from `apps/api/src/lib/database.types.ts`).
- Produces: `createSupabaseServerClient(request: Request, cookies: AstroCookies): SupabaseClient<Database>`. Consumed by Tasks 5, 7, 8.

- [ ] **Step 1: Env example**

Create `apps/admin/.env.example`:

```
# Same Dent Di Supabase project apps/api's dentdi tenant entry points at —
# only the anon key is needed here; this app never uses the service-role key.
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=anon-key-here

# apps/api base URL and the X-Tenant-Slug this app always sends.
API_BASE_URL=http://localhost:8787
TENANT_SLUG=dentdi
```

- [ ] **Step 2: Server client**

Create `apps/admin/src/lib/supabase/server.ts`:

```typescript
import { createServerClient, parseCookieHeader, type CookieOptionsWithName } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "../../../../api/src/lib/database.types.js";

// httpOnly throughout — browser JS never reads the session cookie directly;
// pages that need the raw access token read it server-side (see
// lib/auth/session.ts) and hand it to islands as a prop instead.
const cookieOptions: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: "lax",
  secure: import.meta.env.PROD,
  path: "/",
};

export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  return createServerClient<Database>(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        // Astro writes the Set-Cookie header via cookies.set — also how a
        // refreshed access token (auto-refresh triggered by getUser/
        // getSession) gets persisted without any extra wiring.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.set(name, value, options);
          });
        },
      },
    },
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @booking-system/admin typecheck`
Expected: no errors — confirms the type-only `Database` import from `apps/api` resolves cleanly.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/supabase/server.ts apps/admin/.env.example
git commit -m "feat(admin): add Supabase SSR server client, typed against apps/api's database types"
```

---

## Task 5: Auth session helper + pure route-guard logic

**Files:**
- Create: `apps/admin/src/lib/auth/session.ts`
- Create: `apps/admin/src/lib/auth/route-guard.ts`
- Create: `apps/admin/vitest.config.ts`
- Test: `apps/admin/test/lib/auth/route-guard.test.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 4).
- Produces: `getStaffSession(request, cookies): Promise<StaffSession | null>` and pure `isPublicPath(pathname: string): boolean`. Consumed by Task 6's middleware.

- [ ] **Step 1: Vitest config**

Create `apps/admin/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 2: Write the failing test**

Create `apps/admin/test/lib/auth/route-guard.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { isPublicPath } from "../../../src/lib/auth/route-guard.js";

describe("isPublicPath", () => {
  it("treats /login and the auth API routes as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/logout")).toBe(true);
  });
  it("treats built assets and the favicon as public", () => {
    expect(isPublicPath("/_astro/index.abc123.js")).toBe(true);
    expect(isPublicPath("/favicon.svg")).toBe(true);
  });
  it("treats everything else as protected", () => {
    expect(isPublicPath("/bookings")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/admin && pnpm exec vitest run test/lib/auth/route-guard.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/auth/route-guard.js'`.

- [ ] **Step 4: Implement the route guard**

Create `apps/admin/src/lib/auth/route-guard.ts`:

```typescript
const PUBLIC_EXACT_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);
const PUBLIC_PREFIXES = ["/_astro/", "/favicon"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd apps/admin && pnpm exec vitest run test/lib/auth/route-guard.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 6: Implement the session helper**

Create `apps/admin/src/lib/auth/session.ts`:

```typescript
import type { AstroCookies } from "astro";
import { createSupabaseServerClient } from "../supabase/server.js";

export type StaffSession = { accessToken: string; user: { id: string; email: string } };

// getUser() validates the JWT against Supabase (and auto-refreshes an
// expired one, persisted via server.ts's setAll) — the trust boundary.
// getSession() then just reads the resulting access_token back out.
export async function getStaffSession(request: Request, cookies: AstroCookies): Promise<StaffSession | null> {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;
  return {
    accessToken: sessionData.session.access_token,
    user: { id: userData.user.id, email: userData.user.email ?? "" },
  };
}
```

No dedicated test for this step — it's a thin network-calling wrapper around Supabase Auth (matches the existing project convention of not unit-testing thin `createClient`-style wrappers, e.g. `apps/api/src/lib/supabase.ts`'s `getServiceRoleClient`/`getAnonClient`). Verified live in Task 6/7's manual steps.

- [ ] **Step 7: Run the full admin suite and typecheck**

Run: `cd apps/admin && pnpm exec vitest run && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: clean, 3/3 tests passing.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/vitest.config.ts apps/admin/src/lib/auth apps/admin/test/lib/auth
git commit -m "feat(admin): add staff session helper and route-guard predicate"
```

---

## Task 6: SSR auth middleware

**Files:**
- Create: `apps/admin/src/middleware.ts`

**Interfaces:**
- Consumes: `getStaffSession` (Task 5), `isPublicPath` (Task 5).
- Produces: populates `Astro.locals.session` on every protected request, or redirects to `/login`. Consumed by every protected page (Task 10+).

- [ ] **Step 1: Implement**

Create `apps/admin/src/middleware.ts`:

```typescript
import { defineMiddleware } from "astro/middleware";
import { getStaffSession } from "./lib/auth/session.js";
import { isPublicPath } from "./lib/auth/route-guard.js";

export const onRequest = defineMiddleware(async (context, next) => {
  if (isPublicPath(context.url.pathname)) {
    return next();
  }
  const session = await getStaffSession(context.request, context.cookies);
  if (!session) {
    return context.redirect("/login");
  }
  context.locals.session = session;
  return next();
});
```

- [ ] **Step 2: Manual verification**

Run: `pnpm --filter @booking-system/admin dev`, open `http://localhost:4321`.
Expected: redirected to `/login` (which 404s until Task 7 — that 404, not a crash or infinite redirect loop, is the expected state right now). Open `http://localhost:4321/nonexistent` — same redirect to `/login`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/middleware.ts
git commit -m "feat(admin): add SSR middleware to protect all non-public routes"
```

---

## Task 7: Login page + login API route

**Files:**
- Create: `apps/admin/src/pages/login.astro`
- Create: `apps/admin/src/pages/api/auth/login.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 4).
- Produces: `POST /api/auth/login` (form-encoded `email`/`password`) → sets session cookies, redirects to `/bookings` or back to `/login?error=...`.

- [ ] **Step 1: Login page**

Create `apps/admin/src/pages/login.astro`:

```astro
---
import "../styles/global.css";
const error = Astro.url.searchParams.get("error");
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Log in — Dent Di Back Office</title>
  </head>
  <body class="flex min-h-screen items-center justify-center bg-gray-50">
    <form method="POST" action="/api/auth/login" class="w-80 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 class="text-lg font-semibold">Dent Di Back Office</h1>
      {error && <p class="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div>
        <label for="email" class="block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label for="password" class="block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" required class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <button type="submit" class="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">Log in</button>
    </form>
  </body>
</html>
```

- [ ] **Step 2: Login API route**

Create `apps/admin/src/pages/api/auth/login.ts`:

```typescript
import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server.js";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = form.get("email")?.toString();
  const password = form.get("password")?.toString();
  if (!email || !password) {
    return redirect("/login?error=" + encodeURIComponent("Email and password are required"));
  }
  const supabase = createSupabaseServerClient(request, cookies);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return redirect("/login?error=" + encodeURIComponent(error.message));
  }
  return redirect("/bookings");
};
```

- [ ] **Step 3: Manual verification (LIVE — needs Task 1's account)**

Run: `pnpm --filter @booking-system/admin dev`, visit `http://localhost:4321/login`, submit `owner@dentdi.lv` + the real password from Task 1.
Expected: redirect to `/bookings`; DevTools → Application → Cookies shows a `sb-...-auth-token` cookie with `HttpOnly` checked. Then try a wrong password — expect redirect back to `/login?error=...` with the message rendered. This is also the live verification that Task 1's account actually works — if it fails and Task 1 used Path B, fall back to Path A and retry.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/pages/login.astro apps/admin/src/pages/api/auth/login.ts
git commit -m "feat(admin): add login page and login API route"
```

---

## Task 8: Logout API route

**Files:**
- Create: `apps/admin/src/pages/api/auth/logout.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 4).
- Produces: `POST /api/auth/logout` → clears session cookies, redirects to `/login`. The layout's logout `<form>` (built in Task 3) already targets this path.

- [ ] **Step 1: Implement**

Create `apps/admin/src/pages/api/auth/logout.ts`:

```typescript
import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server.js";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  await supabase.auth.signOut();
  return redirect("/login");
};
```

- [ ] **Step 2: Manual verification (LIVE)**

While logged in on `/bookings`, click "Log out" in the nav.
Expected: redirect to `/login`, session cookie gone. Navigate directly to `http://localhost:4321/bookings` again — expect to be bounced back to `/login`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/pages/api/auth/logout.ts
git commit -m "feat(admin): add logout API route"
```

---

## Task 9: Typed API client module

**Files:**
- Create: `apps/admin/src/lib/api/client.ts`
- Create: `apps/admin/src/lib/api/bookings.ts`
- Create: `apps/admin/src/lib/api/catalog.ts`
- Create: `apps/admin/src/lib/api/errors.ts`
- Test: `apps/admin/test/lib/api/bookings.test.ts`

**Interfaces:**
- Consumes: `Database` (type-only, from `apps/api/src/lib/database.types.ts`).
- Produces: `apiFetch<T>(config, path, init)` generic wrapper (reusable by later Patients/Catalog/Scheduling plans); `ApiError`; `listBookings`/`forceBookBooking`/`cancelBooking`/`rescheduleBooking`; `listServices`/`listStaff` (read-only, for the force-book form's dropdowns only — full catalog CRUD is a later plan's scope); `describeApiError(err)`. Consumed by Tasks 10–13.

- [ ] **Step 1: Write the failing tests**

Create `apps/admin/test/lib/api/bookings.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBookingsQuery, cancelBooking, listBookings } from "../../../src/lib/api/bookings.js";

const config = { baseUrl: "http://localhost:8787", tenantSlug: "dentdi", accessToken: "test-token" };

describe("buildBookingsQuery", () => {
  it("returns empty string with no filters", () => {
    expect(buildBookingsQuery({})).toBe("");
  });
  it("serializes only the provided filters", () => {
    expect(buildBookingsQuery({ status: "confirmed", staffId: "abc" })).toBe("?staffId=abc&status=confirmed");
  });
});

describe("listBookings", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends X-Tenant-Slug and bearer token headers, returns the bookings array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ bookings: [{ id: "b1" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listBookings(config, { status: "confirmed" });

    expect(result).toEqual([{ id: "b1" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8787/admin/bookings?status=confirmed");
    expect(init.headers["X-Tenant-Slug"]).toBe("dentdi");
    expect(init.headers["Authorization"]).toBe("Bearer test-token");
  });

  it("throws ApiError with status and body on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 409, ok: false, json: async () => ({ error: "conflict" }) }));
    await expect(listBookings(config)).rejects.toMatchObject({ status: 409, body: { error: "conflict" } });
  });
});

describe("cancelBooking", () => {
  it("posts to the cancel endpoint and returns the updated booking", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ booking: { id: "b1", status: "cancelled" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await cancelBooking(config, "b1");
    expect(result.status).toBe("cancelled");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8787/admin/bookings/b1/cancel");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/admin && pnpm exec vitest run test/lib/api/bookings.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/api/bookings.js'`.

- [ ] **Step 3: Implement the fetch wrapper**

Create `apps/admin/src/lib/api/client.ts`:

```typescript
export type ApiClientConfig = { baseUrl: string; tenantSlug: string; accessToken: string };

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API request failed with status ${status}`);
  }
}

export async function apiFetch<T>(config: ApiClientConfig, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Slug": config.tenantSlug,
      Authorization: `Bearer ${config.accessToken}`,
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
```

- [ ] **Step 4: Implement the bookings client functions**

Create `apps/admin/src/lib/api/bookings.ts`:

```typescript
import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type BookingStatus = "pending_verification" | "confirmed" | "completed" | "cancelled" | "no_show";

export type ListBookingsFilters = { from?: string; to?: string; staffId?: string; status?: BookingStatus };

export function buildBookingsQuery(filters: ListBookingsFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.staffId) params.set("staffId", filters.staffId);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function listBookings(config: ApiClientConfig, filters: ListBookingsFilters = {}): Promise<Booking[]> {
  const { bookings } = await apiFetch<{ bookings: Booking[] }>(config, `/admin/bookings${buildBookingsQuery(filters)}`);
  return bookings;
}

export type ForceBookInput = {
  serviceId: string; staffId: string; startsAt: string; locale: "lv" | "ru" | "en";
  description?: string; patient: { name: string; email?: string; phone?: string };
};

export async function forceBookBooking(config: ApiClientConfig, input: ForceBookInput): Promise<Booking> {
  const { booking } = await apiFetch<{ booking: Booking }>(config, "/admin/bookings", { method: "POST", body: JSON.stringify(input) });
  return booking;
}

export async function cancelBooking(config: ApiClientConfig, bookingId: string): Promise<Booking> {
  const { booking } = await apiFetch<{ booking: Booking }>(config, `/admin/bookings/${bookingId}/cancel`, { method: "POST" });
  return booking;
}

export async function rescheduleBooking(config: ApiClientConfig, bookingId: string, newStartsAt: string): Promise<Booking> {
  const { booking } = await apiFetch<{ booking: Booking }>(config, `/admin/bookings/${bookingId}/reschedule`, {
    method: "POST", body: JSON.stringify({ newStartsAt }),
  });
  return booking;
}
```

- [ ] **Step 5: Implement the read-only catalog lookups**

Create `apps/admin/src/lib/api/catalog.ts` (read-only — the force-book form's only need; full CRUD is out of scope for this plan, a later Catalog plan extends this file):

```typescript
import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type Service = Database["public"]["Tables"]["services"]["Row"] & {
  name: Record<string, string>;
  description?: Record<string, string>;
};
export type StaffMember = Database["public"]["Tables"]["staff"]["Row"] & { bio: Record<string, string> };

export async function listServices(config: ApiClientConfig): Promise<Service[]> {
  const { services } = await apiFetch<{ services: Service[] }>(config, "/admin/services");
  return services;
}

export async function listStaff(config: ApiClientConfig): Promise<StaffMember[]> {
  const { staff } = await apiFetch<{ staff: StaffMember[] }>(config, "/admin/staff");
  return staff;
}
```

- [ ] **Step 6: Implement the error-message mapper**

Create `apps/admin/src/lib/api/errors.ts`:

```typescript
import { ApiError } from "./client.js";

export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.body as { error?: string } | null)?.error;
    switch (code) {
      case "slot_unavailable": return "That time slot is no longer available.";
      case "already_finalized": return "This booking has already been cancelled or completed.";
      case "invalid_service": return "The selected service is not valid.";
      case "not_found": return "Booking not found — it may have been removed.";
      case "validation_error": return "Some fields are invalid — check the form and try again.";
      default: return `Request failed (${err.status}).`;
    }
  }
  return "Something went wrong. Please try again.";
}
```

- [ ] **Step 7: Run it to verify it passes**

Run: `cd apps/admin && pnpm exec vitest run test/lib/api/bookings.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 8: Run the full admin suite and typecheck**

Run: `cd apps/admin && pnpm exec vitest run && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: clean, 8/8 (3 pre-existing + 5 new).

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/lib/api apps/admin/test/lib/api
git commit -m "feat(admin): add typed API client for bookings and read-only catalog lookups"
```

---

## Task 10: Bookings list + filters (React island)

**Files:**
- Create: `apps/admin/src/lib/format.ts`
- Create: `apps/admin/src/components/BookingsScreen.tsx`
- Modify: `apps/admin/src/pages/bookings.astro` (replace the Task 3 stub)
- Test: `apps/admin/test/lib/format.test.ts`

**Interfaces:**
- Consumes: `listBookings` (Task 9), `Service`/`StaffMember` (Task 9), `describeApiError` (Task 9), `ApiClientConfig` (Task 9), `getStaffSession`/`Astro.locals.session` (Tasks 5–6).
- Produces: `<BookingsScreen client:load apiConfig services staff />`, `formatBookingTime(iso)`, `toDatetimeLocalValue(iso)`. `BookingsScreen` is extended in place by Tasks 11–13.

- [ ] **Step 1: Write the failing tests**

Create `apps/admin/test/lib/format.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatBookingTime, toDatetimeLocalValue } from "../../src/lib/format.js";

describe("formatBookingTime", () => {
  it("formats an ISO timestamp in the clinic's timezone", () => {
    expect(formatBookingTime("2026-03-15T09:00:00Z")).toMatch(/15 Mar 2026/);
  });
});

describe("toDatetimeLocalValue", () => {
  it("produces a value usable by <input type=datetime-local>", () => {
    expect(toDatetimeLocalValue("2026-03-15T09:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/admin && pnpm exec vitest run test/lib/format.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/format.js'`.

- [ ] **Step 3: Implement**

Create `apps/admin/src/lib/format.ts`:

```typescript
export function formatBookingTime(isoString: string, timeZone = "Europe/Riga"): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(isoString));
}

export function toDatetimeLocalValue(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/admin && pnpm exec vitest run test/lib/format.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Build the bookings screen island**

Create `apps/admin/src/components/BookingsScreen.tsx` (list + filters only this task — force-book/cancel/reschedule land in Tasks 11–13, seams left clearly marked):

```tsx
import { useEffect, useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import { listBookings, type Booking, type BookingStatus, type ListBookingsFilters } from "../lib/api/bookings.js";
import type { Service, StaffMember } from "../lib/api/catalog.js";
import { describeApiError } from "../lib/api/errors.js";
import { formatBookingTime } from "../lib/format.js";

const STATUSES: BookingStatus[] = ["pending_verification", "confirmed", "completed", "cancelled", "no_show"];

type Props = { apiConfig: ApiClientConfig; services: Service[]; staff: StaffMember[] };

export default function BookingsScreen({ apiConfig, services, staff }: Props) {
  const [filters, setFilters] = useState<ListBookingsFilters>({});
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setBookings(await listBookings(apiConfig, filters));
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [filters.status, filters.staffId, filters.from, filters.to]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={filters.status ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as BookingStatus | undefined }))}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={filters.staffId ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, staffId: e.target.value || undefined }))}
        >
          <option value="">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" className="rounded border border-gray-300 px-2 py-1 text-sm"
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} />
        <input type="date" className="rounded border border-gray-300 px-2 py-1 text-sm"
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} />
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Starts</th><th>Status</th><th>Staff</th><th>Source</th><th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-gray-100">
                <td className="py-2">{formatBookingTime(b.starts_at)}</td>
                <td>{b.status}</td>
                <td>{staff.find((s) => s.id === b.staff_id)?.name ?? "—"}</td>
                <td>{b.source}</td>
                <td>{/* cancel/reschedule row actions land here in Tasks 12–13 */}</td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-400">No bookings match these filters.</td></tr>}
          </tbody>
        </table>
      )}
      {/* Force-book "New booking" toggle lands here in Task 11 */}
    </div>
  );
}
```

- [ ] **Step 6: Wire the page**

Replace `apps/admin/src/pages/bookings.astro`:

```astro
---
import AdminLayout from "../layouts/AdminLayout.astro";
import BookingsScreen from "../components/BookingsScreen.tsx";
import { listServices, listStaff } from "../lib/api/catalog.js";

const session = Astro.locals.session!;
const apiConfig = {
  baseUrl: import.meta.env.API_BASE_URL,
  tenantSlug: import.meta.env.TENANT_SLUG,
  accessToken: session.accessToken,
};
const [services, staff] = await Promise.all([listServices(apiConfig), listStaff(apiConfig)]);
---
<AdminLayout title="Bookings">
  <BookingsScreen client:load apiConfig={apiConfig} services={services} staff={staff} />
</AdminLayout>
```

- [ ] **Step 7: Run the full admin suite and typecheck**

Run: `cd apps/admin && pnpm exec vitest run && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: clean, 10/10 (8 pre-existing + 2 new).

- [ ] **Step 8: Manual verification (LIVE)**

Log in, land on `/bookings`.
Expected: the seeded live bookings render (28 seeded per `CLAUDE.md`'s seed data), with formatted times and staff names. Filter by each status — the list changes and an empty-state message shows for a status with no matches. Filter by staff — the list narrows correctly.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/lib/format.ts apps/admin/src/components/BookingsScreen.tsx apps/admin/src/pages/bookings.astro apps/admin/test/lib/format.test.ts
git commit -m "feat(admin): add bookings list screen with status/staff/date filters"
```

---

## Task 11: Force-book form

**Files:**
- Create: `apps/admin/src/lib/api/validate-force-book.ts`
- Modify: `apps/admin/src/components/BookingsScreen.tsx`
- Test: `apps/admin/test/lib/api/validate-force-book.test.ts`

**Interfaces:**
- Consumes: `forceBookBooking` (Task 9), `describeApiError` (Task 9).
- Produces: `validateForceBookForm(values): string[]` (pure), `ForceBookFormValues` type. Wires force-booking into the bookings screen.

- [ ] **Step 1: Write the failing tests**

Create `apps/admin/test/lib/api/validate-force-book.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { validateForceBookForm } from "../../../src/lib/api/validate-force-book.js";

const base = { serviceId: "s1", staffId: "st1", startsAt: "2026-03-01T09:00", locale: "lv", patientName: "Anna", patientEmail: "a@b.com", patientPhone: "" };

describe("validateForceBookForm", () => {
  it("passes with a complete valid form", () => expect(validateForceBookForm(base)).toEqual([]));
  it("requires a service", () => expect(validateForceBookForm({ ...base, serviceId: "" })).toContain("Service is required."));
  it("requires patient email or phone", () => expect(validateForceBookForm({ ...base, patientEmail: "", patientPhone: "" }))
    .toContain("Patient email or phone is required."));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/admin && pnpm exec vitest run test/lib/api/validate-force-book.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/api/validate-force-book.js'`.

- [ ] **Step 3: Implement the validator**

Create `apps/admin/src/lib/api/validate-force-book.ts`:

```typescript
export type ForceBookFormValues = {
  serviceId: string; staffId: string; startsAt: string; locale: string;
  patientName: string; patientEmail: string; patientPhone: string;
};

export function validateForceBookForm(values: ForceBookFormValues): string[] {
  const errors: string[] = [];
  if (!values.serviceId) errors.push("Service is required.");
  if (!values.staffId) errors.push("Staff member is required.");
  if (!values.startsAt) errors.push("Start time is required.");
  if (!values.patientName.trim()) errors.push("Patient name is required.");
  if (!values.patientEmail.trim() && !values.patientPhone.trim()) errors.push("Patient email or phone is required.");
  return errors;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/admin && pnpm exec vitest run test/lib/api/validate-force-book.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Wire the form into the screen**

In `apps/admin/src/components/BookingsScreen.tsx`, add to the imports:

```tsx
import { forceBookBooking } from "../lib/api/bookings.js";
import { validateForceBookForm, type ForceBookFormValues } from "../lib/api/validate-force-book.js";
```

Add state and a submit handler inside the component, replacing the `{/* Force-book "New booking" toggle lands here in Task 11 */}` comment's position with actual state declarations above the `return`:

```tsx
const [showForm, setShowForm] = useState(false);
const [formValues, setFormValues] = useState<ForceBookFormValues>({
  serviceId: "", staffId: "", startsAt: "", locale: "lv", patientName: "", patientEmail: "", patientPhone: "",
});
const [formErrors, setFormErrors] = useState<string[]>([]);

async function handleForceBook(e: React.FormEvent) {
  e.preventDefault();
  const errors = validateForceBookForm(formValues);
  setFormErrors(errors);
  if (errors.length > 0) return;
  try {
    await forceBookBooking(apiConfig, {
      serviceId: formValues.serviceId, staffId: formValues.staffId,
      startsAt: new Date(formValues.startsAt).toISOString(), locale: formValues.locale as "lv" | "ru" | "en",
      patient: { name: formValues.patientName, email: formValues.patientEmail || undefined, phone: formValues.patientPhone || undefined },
    });
    setShowForm(false);
    await refresh();
  } catch (err) {
    setFormErrors([describeApiError(err)]);
  }
}
```

Replace the `{/* Force-book "New booking" toggle lands here in Task 11 */}` comment itself with:

```tsx
<button className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white" onClick={() => setShowForm((v) => !v)}>
  {showForm ? "Cancel" : "New booking"}
</button>
{showForm && (
  <form onSubmit={handleForceBook} className="space-y-3 rounded border border-gray-200 bg-white p-4">
    {formErrors.map((msg) => <p key={msg} className="text-sm text-red-700">{msg}</p>)}
    <select value={formValues.serviceId} onChange={(e) => setFormValues((v) => ({ ...v, serviceId: e.target.value }))}>
      <option value="">Select service</option>
      {services.map((s) => <option key={s.id} value={s.id}>{s.name.lv ?? Object.values(s.name)[0]}</option>)}
    </select>
    <select value={formValues.staffId} onChange={(e) => setFormValues((v) => ({ ...v, staffId: e.target.value }))}>
      <option value="">Select staff</option>
      {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
    <input type="datetime-local" value={formValues.startsAt} onChange={(e) => setFormValues((v) => ({ ...v, startsAt: e.target.value }))} />
    <input placeholder="Patient name" value={formValues.patientName} onChange={(e) => setFormValues((v) => ({ ...v, patientName: e.target.value }))} />
    <input placeholder="Email" value={formValues.patientEmail} onChange={(e) => setFormValues((v) => ({ ...v, patientEmail: e.target.value }))} />
    <input placeholder="Phone" value={formValues.patientPhone} onChange={(e) => setFormValues((v) => ({ ...v, patientPhone: e.target.value }))} />
    <button type="submit" className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Book</button>
  </form>
)}
```

- [ ] **Step 6: Run the full admin suite and typecheck**

Run: `cd apps/admin && pnpm exec vitest run && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: clean, 13/13 (10 pre-existing + 3 new).

- [ ] **Step 7: Manual verification (LIVE)**

Force-book a real appointment for a future slot with a new patient (email only).
Expected: it appears in the list with `source: admin_manual`. Then try booking into an already-occupied slot — expect `"That time slot is no longer available."` to render in the form.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/lib/api/validate-force-book.ts apps/admin/src/components/BookingsScreen.tsx apps/admin/test/lib/api/validate-force-book.test.ts
git commit -m "feat(admin): add force-book form to the bookings screen"
```

---

## Task 12: Cancel action

**Files:**
- Modify: `apps/admin/src/components/BookingsScreen.tsx`

**Interfaces:**
- Consumes: `cancelBooking` (Task 9), `describeApiError` (Task 9).
- Produces: nothing new consumed elsewhere. No new pure logic to test — reuses `describeApiError`, verified live.

- [ ] **Step 1: Add the handler and button**

In `apps/admin/src/components/BookingsScreen.tsx`, add to the imports:

```tsx
import { cancelBooking } from "../lib/api/bookings.js";
```

Add the handler function inside the component:

```tsx
async function handleCancel(bookingId: string) {
  if (!window.confirm("Cancel this booking?")) return;
  try {
    await cancelBooking(apiConfig, bookingId);
    await refresh();
  } catch (err) {
    setError(describeApiError(err));
  }
}
```

Replace the `{/* cancel/reschedule row actions land here in Tasks 12–13 */}` comment with:

```tsx
<td>
  {!["cancelled", "completed", "no_show"].includes(b.status) && (
    <button className="text-sm text-red-600 hover:underline" onClick={() => handleCancel(b.id)}>Cancel</button>
  )}
</td>
```

(This replaces the whole `<td>{/* ... */}</td>` element from Task 10's table row.)

- [ ] **Step 2: Run the full admin suite and typecheck**

Run: `cd apps/admin && pnpm exec vitest run && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: clean, 13/13 (no new tests this task).

- [ ] **Step 3: Manual verification (LIVE)**

Cancel a `confirmed` booking created in Task 11.
Expected: its status flips to `cancelled` and the Cancel button disappears for that row. An already-cancelled/completed row shows no Cancel button.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/BookingsScreen.tsx
git commit -m "feat(admin): add cancel action to the bookings list"
```

---

## Task 13: Reschedule form

**Files:**
- Modify: `apps/admin/src/components/BookingsScreen.tsx`

**Interfaces:**
- Consumes: `rescheduleBooking` (Task 9), `toDatetimeLocalValue` (Task 10).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Add state and handler**

In `apps/admin/src/components/BookingsScreen.tsx`, add to the imports:

```tsx
import { rescheduleBooking } from "../lib/api/bookings.js";
import { toDatetimeLocalValue } from "../lib/format.js";
```

Add state and handler inside the component:

```tsx
const [reschedulingId, setReschedulingId] = useState<string | null>(null);
const [newStartsAt, setNewStartsAt] = useState("");

async function handleReschedule(bookingId: string) {
  try {
    await rescheduleBooking(apiConfig, bookingId, new Date(newStartsAt).toISOString());
    setReschedulingId(null);
    await refresh();
  } catch (err) {
    setError(describeApiError(err));
  }
}
```

- [ ] **Step 2: Extend the action cell**

Replace Task 12's action `<td>` content with:

```tsx
<td>
  {!["cancelled", "completed", "no_show"].includes(b.status) && (
    <>
      <button className="text-sm text-red-600 hover:underline" onClick={() => handleCancel(b.id)}>Cancel</button>{" "}
      <button className="text-sm text-blue-600 hover:underline"
        onClick={() => { setReschedulingId(b.id); setNewStartsAt(toDatetimeLocalValue(b.starts_at)); }}>
        Reschedule
      </button>
      {reschedulingId === b.id && (
        <span className="ml-2 inline-flex gap-2">
          <input type="datetime-local" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)} />
          <button className="text-sm text-gray-900" onClick={() => handleReschedule(b.id)}>Save</button>
        </span>
      )}
    </>
  )}
</td>
```

- [ ] **Step 3: Run the full admin suite and typecheck**

Run: `cd apps/admin && pnpm exec vitest run && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: clean, 13/13.

- [ ] **Step 4: Manual verification (LIVE)**

Reschedule a `confirmed` booking to a free future slot.
Expected: the table's "Starts" column updates. Then attempt to reschedule into a slot already occupied by another booking — expect `"That time slot is no longer available."` to render and the original time to remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/BookingsScreen.tsx
git commit -m "feat(admin): add reschedule action to the bookings list"
```

---

## Task 14: End-to-end verification pass + docs update

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** None new — closes the loop on the still-open "not verified live" state for the admin backend and records this plan's build stage, matching the existing `CLAUDE.md` convention.

- [ ] **Step 1: Full test suite, both packages**

Run: `pnpm --filter @booking-system/api test && pnpm --filter @booking-system/api typecheck && pnpm --filter @booking-system/admin test && pnpm --filter @booking-system/admin typecheck`
Expected: all four clean.

- [ ] **Step 2: Full manual LIVE run, fresh session**

`/` → redirect to `/login` → log in → `/bookings` renders live data → apply each filter → force-book → cancel it → force-book another → reschedule it → log out → confirm `/bookings` bounces back to `/login`.
Expected: every step behaves as documented in Tasks 6–13's individual manual-verification steps, run together in one pass rather than in isolation per task.

- [ ] **Step 3: Update CLAUDE.md**

Add a new `[x]` entry under "Current Build Stage" (after the most recent entry) summarizing: `apps/admin` scaffold (Astro SSR + React islands + Tailwind v4), Supabase-Auth-based SSR login/session handling, CORS added to `apps/api`, and the Bookings screen (list/filter/force-book/cancel/reschedule) built against the existing `/admin/bookings*` routes. Change the language around "no real owner account exists yet" / "not live-verified" (in the "Staff/admin backend built" entry and the "Open/Non-Blocking Items" bullet this plan resolves) to confirmed, with today's date, since Task 1 + this task's Step 2 close that loop. Add a Decisions Log row: `Back-office UI stack | Astro (output: "server") + React islands (client:load) + Tailwind v4 via @tailwindcss/vite, apps/admin. SSR auth via @supabase/ssr — Astro middleware checks the session on every request and redirects to /login, rather than a client-side-only check. Distinct neutral admin visual theme (Tailwind defaults), not the public-site's sage/cream/Georgia-serif brand — reserved for the future public marketing site.`

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record apps/admin foundation + bookings screen build-out"
```
