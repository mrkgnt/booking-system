# Staff/Admin Backend + Client-Side Live Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live-verify the already-built patient-facing booking flow now that real Supabase credentials exist, and build the staff/admin backend (auth, booking management, clientele management, catalog & schedule CRUD) that `PROJECT_CONTEXT.md` specifies but nothing in `apps/api` implements yet.

**Architecture:** Staff authenticate directly against Supabase Auth (no login endpoint in Hono — the future staff frontend calls `supabase-js`'s `signInWithPassword` itself). Every `/admin/*` route requires a valid session; a new `staffAuthMiddleware` validates the bearer token and confirms active `business_members` status, then hands each route a **user-scoped Supabase client** (anon key + the staff member's own JWT). All `/admin/*` data access goes through that client, so Postgres RLS (`is_active_member()`, already live on every table) is the real authorization boundary — not app-level logic. The one exception is `staffAuthMiddleware`'s own membership lookup, which uses the service-role client specifically to turn "RLS silently returns zero rows" into a clean 401/403.

**Tech Stack:** Hono, Zod, `@supabase/supabase-js` v2 (already in `apps/api`), Vitest, pnpm.

**Spec:** `PROJECT_CONTEXT.md` (`## Admin/Staff-Facing Backend — Must Support`, `## Booking System Requirements`, `## Schema Notes`) and `CLAUDE.md` (Decisions Log; Open/Non-Blocking Items — admin-side booking management entry). No new spec doc — these two files are the project's living spec.

## Global Constraints

- No database migrations in this plan — every table `/admin/*` needs (`business_members`, `roles`, `audit_log`, `staff`, `staff_services`, `business_hours`, `closures`, `service_categories`, `services`, `translations`, `patients`, `bookings`) already exists in `db/tenant-schema.sql` and on the live Dent Di project.
- `/admin/*` routes owner/staff parity is intentional MVP behavior (`PROJECT_CONTEXT.md`: "Policies are intentionally permissive between owner/staff for MVP") — do not add role-specific gating beyond "is an active member." `roles.permissions` is a reserved-for-later stub; leave it unused.
- Every `/admin/*` route chains `tenantMiddleware` then `staffAuthMiddleware`, in that order (middleware needs `c.get("tenant")`).
- Every `/admin/*` data query uses `c.get("supabaseUser")` (RLS-scoped), never `getServiceRoleClient`, except inside `staffAuthMiddleware` itself.
- No Turnstile or rate-limit middleware on `/admin/*` routes — the abuse surface is different from the public booking endpoints (a request already needs a valid staff bearer token; brute-forcing login itself goes through Supabase Auth directly, which has its own limits).
- Every manual override (`force_book`, `staff_cancel`, `staff_reschedule`) writes one `audit_log` row: `actor_member_id`, `action`, `target_type: "booking"`, `target_id`, `before`, `after`.
- Locales: `"lv" | "ru" | "en"` (matches `business_profile.supported_locales` for Dent Di, and the existing `locale` enum in `bookings.schema.ts`). Translation-bearing request bodies accept a `Record<locale, string>`; nothing in this plan validates the locale keys against `business_profile.supported_locales` at request time — noted as an accepted MVP gap, not silently dropped.
- File naming follows the existing flat `routes/*.ts` + `routes/*.schema.ts` convention (see `routes/bookings.ts` / `routes/bookings.schema.ts`) — no nested `routes/admin/` folder.
- Response conventions match the existing codebase: `{ error: "validation_error", details }` (400) from `.safeParse()` failures, `{ error: "not_found" }` (404), `classifySupabaseError()` for Postgres errors, success bodies keyed by resource name (e.g. `{ booking }`, `{ bookings: [...] }`).
- Run `pnpm exec tsc --noEmit` and `pnpm run test` from `apps/api` after every task; both must be clean before moving on.
- Steps that require live network access to `*.supabase.co` are marked **LIVE** — run those locally, not inside a network-restricted agent sandbox (see `CLAUDE.md`'s history of this exact restriction blocking earlier verification passes).

---

### Task 1: Live-verify the existing client-side booking flow

**Files:** None — no code changes. Verifies work already merged (`GET /availability`, `POST /bookings`, `/bookings/confirm`, `/bookings/cancel`, `/bookings/reschedule`) now that `apps/api/.env` has real `DENTDI_SUPABASE_URL` / `DENTDI_SUPABASE_ANON_KEY` / `DENTDI_SUPABASE_SECRET_KEY` values.

**Interfaces:**
- Consumes: nothing new.
- Produces: confidence that `getServiceRoleClient()` and the booking routes work against the real Dent Di project — every later task's admin routes build on the same Supabase client plumbing.

- [ ] **Step 1: Start the API locally**

```bash
cd apps/api
pnpm run dev
```

Expected: logs show the server listening on port 8787, no startup error.

- [ ] **Step 2 (LIVE): Confirm the live-DB smoke path**

```bash
curl -s localhost:8787/_smoke/business-profile -H "X-Tenant-Slug: dentdi" | head -c 500
```

Expected: `200` with a real `business_profile` row (slug `dentdi`), not the previously-documented "Host not in allowlist" error.

- [ ] **Step 3 (LIVE): Run the full booking flow end to end**

```bash
# 1. Get an available slot
curl -s "localhost:8787/availability?service_id=<a-real-service-id>&date=2026-09-01" \
  -H "X-Tenant-Slug: dentdi" | head -c 500

# 2. Create a booking using a slot from step 1's response
curl -s -X POST localhost:8787/bookings -H "X-Tenant-Slug: dentdi" -H "Content-Type: application/json" -d '{
  "serviceId": "<service-id>",
  "startsAt": "<slot-from-step-1>",
  "locale": "en",
  "patient": { "name": "Test Patient", "email": "test@example.com" },
  "consentGiven": true,
  "idempotencyKey": "live-verify-'"$(date +%s)"'"
}'
# Response includes _dev_confirm_url (NODE_ENV != production) — grab the token query param.

# 3. Confirm
curl -s -X POST localhost:8787/bookings/confirm -H "X-Tenant-Slug: dentdi" -H "Content-Type: application/json" \
  -d '{"token": "<token-from-_dev_confirm_url>"}'
# Response includes _dev_cancel_url and _dev_reschedule_url.

# 4. Cancel (or reschedule, using the corresponding token)
curl -s -X POST localhost:8787/bookings/cancel -H "X-Tenant-Slug: dentdi" -H "Content-Type: application/json" \
  -d '{"token": "<token-from-_dev_cancel_url>"}'
```

Expected: each call returns the documented shape and status code (`201` on create, `200` on confirm/cancel), and the booking's `status` transitions `pending_verification` → `confirmed` → `cancelled` when queried via Supabase MCP `execute_sql`.

- [ ] **Step 4: Update CLAUDE.md**

Change the `.env` / live-verification notes under "Booking creation implemented" and "cancel/reschedule implemented" from "Not verified live" to confirmed, with today's date. No code diff to commit here beyond the doc update — commit it with Task 17's doc update instead of separately, to avoid a doc-only commit mid-plan.

---

### Task 2: Bootstrap the first staff (owner) account

**Files:** None — one-time data setup against the live project, not a code change.

**Interfaces:**
- Produces: a real `auth.users` row + a `business_members` row (`role_id` → `owner`, `status = 'active'`) and a saved access token. Every later task's live-verification step authenticates as this account.

- [ ] **Step 1 (LIVE): Create the Supabase Auth user via the Admin API**

```bash
cd apps/api
set -a; source .env; set +a

curl -s -X POST "$DENTDI_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $DENTDI_SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $DENTDI_SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@dentdi.lv",
    "password": "REPLACE-WITH-A-STRONG-PASSWORD",
    "email_confirm": true
  }'
```

Expected: `201`, response body includes `"id": "<uuid>"` — save it as `OWNER_USER_ID`.

- [ ] **Step 2: Insert the matching `business_members` row**

Via Supabase MCP `execute_sql` against project `eafeskigfcinnwahjiyx`:

```sql
insert into business_members (user_id, role_id, status)
select '<OWNER_USER_ID>', id, 'active'
from roles
where key = 'owner';
```

Expected: 1 row inserted. This is the one legitimate use of a privileged connection to write `business_members` directly — it's the bootstrap for the very first account, before any `/admin/*` route exists to do it through RLS. A second staff account should go through `/admin/staff`-adjacent tooling later (out of scope here), not this manual path.

- [ ] **Step 3 (LIVE): Get a session access token for later curl verification**

```bash
curl -s -X POST "$DENTDI_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $DENTDI_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "owner@dentdi.lv", "password": "REPLACE-WITH-A-STRONG-PASSWORD"}'
```

Expected: `200`, response body includes `"access_token": "<jwt>"`. Save this as `OWNER_TOKEN` — every later task's live-verification step sends `Authorization: Bearer $OWNER_TOKEN`.

- [ ] **Step 4: Confirm `is_active_member()` sees this user as active**

Via Supabase MCP `execute_sql`:

```sql
select bm.status, r.key as role_key
from business_members bm
join roles r on r.id = bm.role_id
where bm.user_id = '<OWNER_USER_ID>';
```

Expected: one row, `status = 'active'`, `role_key = 'owner'`.

---

### Task 3: Add `getUserScopedClient()` to `lib/supabase.ts`

**Files:**
- Modify: `apps/api/src/lib/supabase.ts`

**Interfaces:**
- Consumes: `TenantConfig` (existing), a raw JWT string.
- Produces: `getUserScopedClient(tenant: TenantConfig, accessToken: string): TypedSupabaseClient` — used by `staffAuthMiddleware` (Task 5) and nowhere else.

No test for this step — matches the existing convention that `getServiceRoleClient`/`getAnonClient` in this same file have no dedicated unit test (they're thin `createClient` wrappers; the interesting behavior is exercised through the routes that use them).

- [ ] **Step 1: Add the function**

In `apps/api/src/lib/supabase.ts`, after `getAnonClient`:

```typescript
// User-scoped client: PostgREST reads the caller's own JWT off this
// client's requests, so auth.uid() resolves to the staff member and RLS
// (is_active_member()) becomes the real authorization boundary for every
// /admin/* route — see staffAuth.ts and CLAUDE.md for the full rationale.
export function getUserScopedClient(tenant: TenantConfig, accessToken: string): TypedSupabaseClient {
  return createClient<Database>(tenant.supabaseUrl, tenant.supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/supabase.ts
git commit -m "feat(api): add getUserScopedClient for RLS-scoped admin requests"
```

---

### Task 4: `lib/translations.ts` helper

**Files:**
- Create: `apps/api/src/lib/translations.ts`
- Test: `apps/api/test/translations.test.ts`

**Interfaces:**
- Consumes: `TypedSupabaseClient` (from `lib/supabase.ts`).
- Produces: `upsertTranslations(supabase, entityType, entityId, translations)`, `fetchTranslations(supabase, entityType, entityId)`, `deleteTranslations(supabase, entityType, entityId)`, `toLocaleMap(rows, field)` — consumed by Tasks 12–14 (service categories, services, staff CRUD), all of which store per-locale text (`name`, `description`, `bio`) in the shared `translations` table instead of columns on their own tables (see `db/tenant-schema.sql`'s `translations` table and its `entity_type` comment). `toLocaleMap` is what keeps those three tasks' `GET`/`POST`/`PATCH` responses shaped consistently — every one of them returns translated fields as `{ locale: value }`, never the raw `[{locale, field, value}]` row list.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/translations.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { deleteTranslations, fetchTranslations, toLocaleMap, upsertTranslations } from "../src/lib/translations.js";

// A hand-rolled fake standing in for TypedSupabaseClient's fluent builder —
// enough of the chain shape to prove each helper calls the right methods
// with the right arguments, without touching a live Supabase project.
function makeFakeSupabase() {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });

  const selectEq2 = vi.fn().mockResolvedValue({
    data: [{ locale: "en", field: "name", value: "Cleaning" }],
    error: null,
  });
  const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
  const select = vi.fn().mockReturnValue({ eq: selectEq1 });

  const deleteEq2 = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
  const del = vi.fn().mockReturnValue({ eq: deleteEq1 });

  const from = vi.fn().mockReturnValue({ upsert, select, delete: del });

  return { from, upsert, select, selectEq1, selectEq2, del, deleteEq1, deleteEq2 };
}

describe("upsertTranslations", () => {
  it("does nothing and makes no call when given an empty array", async () => {
    const supabase = makeFakeSupabase();
    await upsertTranslations(supabase as never, "service", "svc-1", []);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("upserts one row per translation against the composite conflict target", async () => {
    const supabase = makeFakeSupabase();
    await upsertTranslations(supabase as never, "service", "svc-1", [
      { locale: "en", field: "name", value: "Cleaning" },
      { locale: "lv", field: "name", value: "Tīrīšana" },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("translations");
    expect(supabase.upsert).toHaveBeenCalledWith(
      [
        { entity_type: "service", entity_id: "svc-1", locale: "en", field: "name", value: "Cleaning" },
        { entity_type: "service", entity_id: "svc-1", locale: "lv", field: "name", value: "Tīrīšana" },
      ],
      { onConflict: "entity_type,entity_id,locale,field" },
    );
  });
});

describe("fetchTranslations", () => {
  it("filters by entity_type and entity_id and returns the rows", async () => {
    const supabase = makeFakeSupabase();
    const result = await fetchTranslations(supabase as never, "service", "svc-1");
    expect(supabase.from).toHaveBeenCalledWith("translations");
    expect(supabase.select).toHaveBeenCalledWith("locale, field, value");
    expect(supabase.selectEq1).toHaveBeenCalledWith("entity_type", "service");
    expect(supabase.selectEq2).toHaveBeenCalledWith("entity_id", "svc-1");
    expect(result).toEqual([{ locale: "en", field: "name", value: "Cleaning" }]);
  });

  it("returns an empty array when the query returns null data", async () => {
    const supabase = makeFakeSupabase();
    supabase.selectEq2.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchTranslations(supabase as never, "service", "svc-1");
    expect(result).toEqual([]);
  });
});

describe("deleteTranslations", () => {
  it("deletes by entity_type and entity_id", async () => {
    const supabase = makeFakeSupabase();
    await deleteTranslations(supabase as never, "service", "svc-1");
    expect(supabase.from).toHaveBeenCalledWith("translations");
    expect(supabase.deleteEq1).toHaveBeenCalledWith("entity_type", "service");
    expect(supabase.deleteEq2).toHaveBeenCalledWith("entity_id", "svc-1");
  });
});

describe("toLocaleMap", () => {
  it("keeps only rows matching the given field, keyed by locale", () => {
    const result = toLocaleMap(
      [
        { locale: "en", field: "name", value: "Cleaning" },
        { locale: "lv", field: "name", value: "Tīrīšana" },
        { locale: "en", field: "description", value: "A routine cleaning" },
      ],
      "name",
    );
    expect(result).toEqual({ en: "Cleaning", lv: "Tīrīšana" });
  });

  it("returns an empty object when no rows match the field", () => {
    expect(toLocaleMap([{ locale: "en", field: "description", value: "x" }], "name")).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/translations.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/translations.js'`.

- [ ] **Step 3: Implement**

Create `apps/api/src/lib/translations.ts`:

```typescript
import type { TypedSupabaseClient } from "./supabase.js";

// Generic i18n storage helpers for the shared `translations` table (see
// db/tenant-schema.sql) — every admin CRUD route that edits a translatable
// entity (service_categories, services, staff) goes through these instead
// of hand-rolling the same upsert/fetch/delete shape three times.

export type TranslationInput = { locale: string; field: string; value: string };
export type TranslationRow = { locale: string; field: string; value: string };

export async function upsertTranslations(
  supabase: TypedSupabaseClient,
  entityType: string,
  entityId: string,
  translations: TranslationInput[],
): Promise<void> {
  if (translations.length === 0) return;
  await supabase.from("translations").upsert(
    translations.map((t) => ({
      entity_type: entityType,
      entity_id: entityId,
      locale: t.locale,
      field: t.field,
      value: t.value,
    })),
    { onConflict: "entity_type,entity_id,locale,field" },
  );
}

export async function fetchTranslations(
  supabase: TypedSupabaseClient,
  entityType: string,
  entityId: string,
): Promise<TranslationRow[]> {
  const { data } = await supabase
    .from("translations")
    .select("locale, field, value")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  return data ?? [];
}

export async function deleteTranslations(
  supabase: TypedSupabaseClient,
  entityType: string,
  entityId: string,
): Promise<void> {
  await supabase.from("translations").delete().eq("entity_type", entityType).eq("entity_id", entityId);
}

// Reshapes fetchTranslations()'s row list into the { locale: value } map
// every admin CRUD route (Tasks 12-14) both accepts on write and returns
// on read — keeps GET/POST/PATCH responses for the same resource shaped
// identically instead of round-tripping the raw {locale, field, value} rows.
export function toLocaleMap(rows: TranslationRow[], field: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.field === field) {
      map[row.locale] = row.value;
    }
  }
  return map;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/translations.test.ts`
Expected: PASS, 8/8.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/translations.ts apps/api/test/translations.test.ts
git commit -m "feat(api): add translations upsert/fetch/delete helper for admin CRUD routes"
```

---

### Task 5: `staffAuthMiddleware`

**Files:**
- Create: `apps/api/src/middleware/staffAuth.ts`
- Test: `apps/api/test/staffAuth.test.ts`

**Interfaces:**
- Consumes: `TenantVariables` (from `middleware/tenant.ts`), `getServiceRoleClient`/`getUserScopedClient`/`TypedSupabaseClient` (from `lib/supabase.ts`).
- Produces: `extractBearerToken(header: string | undefined): string | null` (pure, tested directly), `StaffAuthVariables = { staffMember: { id: string; userId: string; roleKey: string }; supabaseUser: TypedSupabaseClient }`, `staffAuthMiddleware: MiddlewareHandler<{ Variables: TenantVariables & StaffAuthVariables }>`. Every task from 6 onward imports `staffAuthMiddleware` and `type StaffAuthVariables`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/staffAuth.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { extractBearerToken } from "../src/middleware/staffAuth.js";

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("returns null when the header is missing", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null when the header doesn't start with 'Bearer '", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractBearerToken("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/staffAuth.test.ts`
Expected: FAIL — `Cannot find module '../src/middleware/staffAuth.js'`.

- [ ] **Step 3: Implement**

Create `apps/api/src/middleware/staffAuth.ts`:

```typescript
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/staffAuth.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean, all existing tests still passing (this task only adds files, touches nothing existing).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/staffAuth.ts apps/api/test/staffAuth.test.ts
git commit -m "feat(api): add staffAuthMiddleware — session + active-membership check for /admin/* routes"
```

---

### Task 6: `GET /admin/me`

**Files:**
- Create: `apps/api/src/routes/admin-me.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/admin-me.route.test.ts`

**Interfaces:**
- Consumes: `tenantMiddleware`/`TenantVariables`, `staffAuthMiddleware`/`StaffAuthVariables` (Task 5).
- Produces: `adminMeRoute` (Hono instance), registered at `/admin/me`. First concrete proof the auth chain works end to end — every later admin route reuses the exact same two-middleware chain.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-me.route.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

// Same convention as bookings.route.test.ts: only the pre-DB-call
// shape/auth failures are provable without a live Supabase project. The
// 200 happy path is verified live in this task's Step 6.

describe("GET /admin/me — tenant and auth shape checks", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/admin/me");
    expect(res.status).toBe(400);
  });

  it("404s for an unknown tenant slug", async () => {
    const res = await app.request("/admin/me", { headers: { "X-Tenant-Slug": "nonexistent" } });
    expect(res.status).toBe(404);
  });

  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/me", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("401s with a malformed Authorization header", async () => {
    const res = await app.request("/admin/me", {
      headers: { "X-Tenant-Slug": "dentdi", Authorization: "Basic not-a-bearer-token" },
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-me.route.test.ts`
Expected: FAIL — `/admin/me` doesn't exist yet, so `app.request()` returns Hono's default 404 (`{}`/text), not the `400`/`401` these tests expect.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/admin-me.ts`:

```typescript
import { Hono } from "hono";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";

export const adminMeRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminMeRoute.get("/admin/me", tenantMiddleware, staffAuthMiddleware, async (c) => {
  return c.json({ staffMember: c.get("staffMember") });
});
```

In `apps/api/src/app.ts`, add the import and registration:

```typescript
import { adminMeRoute } from "./routes/admin-me.js";
```

```typescript
app.route("/", adminMeRoute);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-me.route.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify the 200 path**

Using `OWNER_TOKEN` from Task 2:

```bash
curl -s localhost:8787/admin/me -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
```

Expected: `200`, `{"staffMember":{"id":"...","userId":"...","roleKey":"owner"}}`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-me.ts apps/api/src/app.ts apps/api/test/admin-me.route.test.ts
git commit -m "feat(api): add GET /admin/me — first protected admin route, proves the auth chain"
```

---

### Task 7: `GET /admin/bookings` (list/filter)

**Files:**
- Create: `apps/api/src/routes/admin-bookings.schema.ts`
- Create: `apps/api/src/routes/admin-bookings.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/admin-bookings.route.test.ts`

**Interfaces:**
- Consumes: `staffAuthMiddleware`, `tenantMiddleware`, `classifySupabaseError` (from `lib/pg-errors.ts`).
- Produces: `adminBookingsRoute` (Hono instance) — this task adds `GET /admin/bookings` to it; Tasks 8–10 add more handlers to the same file/route instance.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-bookings.route.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /admin/bookings — tenant, auth, and validation shape checks", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/admin/bookings");
    expect(res.status).toBe(400);
  });

  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/bookings", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-bookings.route.test.ts`
Expected: FAIL — `/admin/bookings` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/admin-bookings.schema.ts`:

```typescript
import { z } from "zod";

export const listBookingsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  staffId: z.string().uuid().optional(),
  status: z
    .enum(["pending_verification", "confirmed", "completed", "cancelled", "no_show"])
    .optional(),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
```

Create `apps/api/src/routes/admin-bookings.ts`:

```typescript
import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { listBookingsQuerySchema } from "./admin-bookings.schema.js";

export const adminBookingsRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminBookingsRoute.get("/admin/bookings", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = listBookingsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const { from, to, staffId, status } = parsed.data;

  const supabase = c.get("supabaseUser");
  let query = supabase.from("bookings").select("*").order("starts_at", { ascending: true });
  if (from) query = query.gte("starts_at", from);
  if (to) query = query.lte("starts_at", to);
  if (staffId) query = query.eq("staff_id", staffId);
  if (status) query = query.eq("status", status);

  const { data: bookings, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ bookings: bookings ?? [] });
});
```

In `apps/api/src/app.ts`:

```typescript
import { adminBookingsRoute } from "./routes/admin-bookings.js";
```

```typescript
app.route("/", adminBookingsRoute);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-bookings.route.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify the 200 path**

```bash
curl -s "localhost:8787/admin/bookings?status=confirmed" -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
```

Expected: `200`, `{"bookings": [...]}` — includes the booking confirmed in Task 1 if its status still matches the filter.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-bookings.schema.ts apps/api/src/routes/admin-bookings.ts apps/api/src/app.ts apps/api/test/admin-bookings.route.test.ts
git commit -m "feat(api): add GET /admin/bookings — filterable list for staff"
```

---

### Task 8: Extract `hasExistingConflict` + `POST /admin/bookings` (force-book)

**Files:**
- Create: `apps/api/src/lib/booking-conflicts.ts`
- Modify: `apps/api/src/routes/bookings.ts` (remove the private `hasExistingConflict`, import the shared one)
- Modify: `apps/api/src/routes/admin-bookings.schema.ts` (add `forceBookSchema`)
- Modify: `apps/api/src/routes/admin-bookings.ts` (add the `POST /admin/bookings` handler)
- Test: `apps/api/test/admin-bookings.route.test.ts` (extend)

**Interfaces:**
- Consumes: `hasBufferConflict` (from `lib/availability.ts`), `selectMatchingPatient`/`PatientCandidate` (from `lib/patient-matching.ts`).
- Produces: `hasExistingConflict(supabase, staffId, startsAt, endsAt, service, excludeBookingId?): Promise<boolean>` in the new shared module — used by this task's force-book handler and by Task 9 (staff-reschedule), and still used by the existing public `/bookings` and `/bookings/reschedule` routes after the refactor.

- [ ] **Step 1: Extract the shared conflict-check function (refactor, no behavior change)**

Create `apps/api/src/lib/booking-conflicts.ts` with the exact body currently at the bottom of `apps/api/src/routes/bookings.ts` (the private `hasExistingConflict` function), retyped against the shared client type:

```typescript
import type { TypedSupabaseClient } from "./supabase.js";
import { hasBufferConflict } from "./availability.js";

export async function hasExistingConflict(
  supabase: TypedSupabaseClient,
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  service: { buffer_minutes_before: number; buffer_minutes_after: number },
  excludeBookingId?: string,
): Promise<boolean> {
  const bufferMs = 24 * 60 * 60_000; // widen the query window by a day either side to safely catch buffer-adjacent bookings
  let query = supabase
    .from("bookings")
    .select("starts_at, ends_at, services:service_id(buffer_minutes_before, buffer_minutes_after)")
    .eq("staff_id", staffId)
    .not("status", "in", "(cancelled,no_show)")
    .gte("starts_at", new Date(startsAt.getTime() - bufferMs).toISOString())
    .lte("starts_at", new Date(endsAt.getTime() + bufferMs).toISOString());
  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }
  const { data: nearby } = await query;

  return hasBufferConflict(
    {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      bufferBeforeMinutes: service.buffer_minutes_before,
      bufferAfterMinutes: service.buffer_minutes_after,
    },
    (nearby ?? []).map((b) => {
      const svc = b.services as { buffer_minutes_before: number; buffer_minutes_after: number } | null;
      return {
        staffId,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        bufferBeforeMinutes: svc?.buffer_minutes_before ?? 0,
        bufferAfterMinutes: svc?.buffer_minutes_after ?? 0,
      };
    }),
  );
}
```

In `apps/api/src/routes/bookings.ts`:
- Delete the private `async function hasExistingConflict(...) { ... }` block at the bottom of the file (everything from `async function hasExistingConflict` to the file's final closing brace).
- Add the import near the top: `import { hasExistingConflict } from "../lib/booking-conflicts.js";`
- Leave every call site (`hasExistingConflict(supabase, ...)`) untouched — same name, same signature, same behavior.

- [ ] **Step 2: Confirm the refactor didn't break anything**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean, all 60 pre-existing tests still passing — this step is the safety net for the refactor; there is no new test for `hasExistingConflict` itself (there wasn't one before the move either).

- [ ] **Step 3: Commit the refactor on its own**

```bash
git add apps/api/src/lib/booking-conflicts.ts apps/api/src/routes/bookings.ts
git commit -m "refactor(api): extract hasExistingConflict into a shared lib module"
```

- [ ] **Step 4: Write the failing test for force-book**

Add to `apps/api/test/admin-bookings.route.test.ts`:

```typescript
describe("POST /admin/bookings (force-book) — tenant, auth, and validation shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/bookings", {
      method: "POST",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-bookings.route.test.ts`
Expected: FAIL — `POST /admin/bookings` doesn't exist yet, so this hits Hono's default 404 instead of 401.

- [ ] **Step 6: Implement**

Add to `apps/api/src/routes/admin-bookings.schema.ts`:

```typescript
export const forceBookSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startsAt: z.string().datetime(),
  locale: z.enum(["lv", "ru", "en"]),
  description: z.string().max(2000).optional(),
  patient: z
    .object({
      name: z.string().min(1).max(200),
      email: z.string().email().optional(),
      phone: z.string().min(5).max(32).optional(),
    })
    .refine((p) => p.email || p.phone, { message: "email or phone is required" }),
});
export type ForceBookInput = z.infer<typeof forceBookSchema>;
```

In `apps/api/src/routes/admin-bookings.ts`, add imports and the new handler:

```typescript
import { hasExistingConflict } from "../lib/booking-conflicts.js";
import { selectMatchingPatient, type PatientCandidate } from "../lib/patient-matching.js";
import { forceBookSchema, listBookingsQuerySchema } from "./admin-bookings.schema.js";
```

```typescript
adminBookingsRoute.post("/admin/bookings", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = forceBookSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const staffMember = c.get("staffMember");

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, duration_minutes, buffer_minutes_before, buffer_minutes_after, is_active")
    .eq("id", input.serviceId)
    .maybeSingle();
  if (serviceError || !service || !service.is_active) {
    return c.json({ error: "invalid_service" }, 422);
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);

  const conflict = await hasExistingConflict(supabase, input.staffId, startsAt, endsAt, service);
  if (conflict) {
    return c.json({ error: "slot_unavailable" }, 409);
  }

  const orFilters = [
    input.patient.email ? `email.eq.${input.patient.email}` : null,
    input.patient.phone ? `phone.eq.${input.patient.phone}` : null,
  ].filter((f): f is string => f !== null);
  const { data: candidateRows } = await supabase
    .from("patients")
    .select("id, email, phone, created_at")
    .or(orFilters.join(","));
  const candidates: PatientCandidate[] = (candidateRows ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    phone: p.phone,
    createdAt: p.created_at,
  }));
  const matchedPatient = selectMatchingPatient(candidates, {
    email: input.patient.email,
    phone: input.patient.phone,
  });

  let patientId: string;
  if (matchedPatient) {
    patientId = matchedPatient.id;
  } else {
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({
        name: input.patient.name,
        email: input.patient.email,
        phone: input.patient.phone,
        preferred_locale: input.locale,
      })
      .select("id")
      .single();
    if (patientError || !newPatient) {
      const { httpStatus, body } = classifySupabaseError(patientError ?? {});
      return c.json(body, httpStatus as 409 | 500);
    }
    patientId = newPatient.id;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      patient_id: patientId,
      service_id: input.serviceId,
      staff_id: input.staffId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      locale: input.locale,
      description: input.description,
      status: "confirmed",
      source: "admin_manual",
      consent_given_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (bookingError || !booking) {
    const { httpStatus, body } = classifySupabaseError(bookingError ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }

  await supabase.from("audit_log").insert({
    actor_member_id: staffMember.id,
    action: "force_book",
    target_type: "booking",
    target_id: booking.id,
    before: null,
    after: booking,
  });

  return c.json({ booking }, 201);
});
```

- [ ] **Step 7: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-bookings.route.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 9 (LIVE): Verify the 201 path**

```bash
curl -s -X POST localhost:8787/admin/bookings -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{
  "serviceId": "<a-real-service-id>",
  "staffId": "<a-real-staff-id>",
  "startsAt": "2026-09-02T10:00:00.000Z",
  "locale": "en",
  "patient": { "name": "Force Booked Patient", "phone": "+37120000000" }
}'
```

Expected: `201`, `{"booking": {"status": "confirmed", "source": "admin_manual", ...}}`. Confirm via Supabase MCP `execute_sql` that a matching `audit_log` row exists (`action = 'force_book'`).

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/routes/admin-bookings.schema.ts apps/api/src/routes/admin-bookings.ts apps/api/test/admin-bookings.route.test.ts
git commit -m "feat(api): add POST /admin/bookings — staff force-book with audit logging"
```

---

### Task 9: `POST /admin/bookings/:id/cancel` (staff-cancel)

**Files:**
- Modify: `apps/api/src/routes/admin-bookings.schema.ts` (add `bookingIdParamSchema`)
- Modify: `apps/api/src/routes/admin-bookings.ts`
- Test: `apps/api/test/admin-bookings.route.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new consumed elsewhere.

Unlike the patient-facing `/bookings/cancel` (`routes/bookings.ts`), this endpoint does **not** reject an already-past `starts_at` — staff overriding a stale/incorrect record (e.g. fixing a no-show marked wrong) is exactly the "outside normal rules" case `PROJECT_CONTEXT.md` describes for manual overrides. It still rejects already-finalized bookings (`cancelled`/`completed`/`no_show`) since re-cancelling those is never meaningful.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/test/admin-bookings.route.test.ts`:

```typescript
describe("POST /admin/bookings/:id/cancel — tenant, auth, and validation shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/bookings/00000000-0000-0000-0000-000000000001/cancel", {
      method: "POST",
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-bookings.route.test.ts`
Expected: FAIL — route doesn't exist, hits default 404.

- [ ] **Step 3: Implement**

Add to `apps/api/src/routes/admin-bookings.schema.ts`:

```typescript
export const bookingIdParamSchema = z.object({ id: z.string().uuid() });
```

Add to `apps/api/src/routes/admin-bookings.ts` (update the schema import line to include `bookingIdParamSchema`):

```typescript
const FINALIZED_STATUSES = ["cancelled", "completed", "no_show"] as const;

adminBookingsRoute.post("/admin/bookings/:id/cancel", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = bookingIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const staffMember = c.get("staffMember");

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (!booking) {
    return c.json({ error: "not_found" }, 404);
  }
  if (FINALIZED_STATUSES.includes(booking.status as (typeof FINALIZED_STATUSES)[number])) {
    return c.json({ error: "already_finalized" }, 409);
  }

  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: staffMember.id })
    .eq("id", booking.id)
    .select("*")
    .single();
  if (updateError || !updated) {
    const { httpStatus, body } = classifySupabaseError(updateError ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }

  await supabase.from("audit_log").insert({
    actor_member_id: staffMember.id,
    action: "staff_cancel",
    target_type: "booking",
    target_id: booking.id,
    before: booking,
    after: updated,
  });

  return c.json({ booking: updated });
});
```

Place `FINALIZED_STATUSES` once near the top of the file, above the route handlers — it's reused by Task 10's reschedule handler.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-bookings.route.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify the 200 path**

Using a real booking id from Task 8's force-book response:

```bash
curl -s -X POST localhost:8787/admin/bookings/<booking-id>/cancel -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
```

Expected: `200`, `{"booking": {"status": "cancelled", "cancelled_by": "<owner-business-member-id>", ...}}`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-bookings.schema.ts apps/api/src/routes/admin-bookings.ts apps/api/test/admin-bookings.route.test.ts
git commit -m "feat(api): add POST /admin/bookings/:id/cancel — staff override with audit logging"
```

---

### Task 10: `POST /admin/bookings/:id/reschedule` (staff-reschedule)

**Files:**
- Modify: `apps/api/src/routes/admin-bookings.schema.ts` (add `staffRescheduleSchema`)
- Modify: `apps/api/src/routes/admin-bookings.ts`
- Test: `apps/api/test/admin-bookings.route.test.ts` (extend)

**Interfaces:**
- Consumes: `hasExistingConflict` (Task 8), `FINALIZED_STATUSES` (Task 9).

Unlike the patient-facing `/bookings/reschedule`, this endpoint does **not** enforce `MIN_BOOKING_LEAD_MINUTES` — that's a courtesy rule for the public form, not a physical scheduling constraint, and staff overriding it is the documented "outside normal rules" case. It still runs the buffer-aware conflict check (`hasExistingConflict`) — that one is a real double-booking prevention, not a courtesy rule, and staff shouldn't be able to double-book a room/chair by accident.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/test/admin-bookings.route.test.ts`:

```typescript
describe("POST /admin/bookings/:id/reschedule — tenant, auth, and validation shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/bookings/00000000-0000-0000-0000-000000000001/reschedule", {
      method: "POST",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: JSON.stringify({ newStartsAt: "2027-03-01T10:00:00.000Z" }),
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-bookings.route.test.ts`
Expected: FAIL — route doesn't exist, hits default 404.

- [ ] **Step 3: Implement**

Add to `apps/api/src/routes/admin-bookings.schema.ts`:

```typescript
export const staffRescheduleSchema = z.object({
  newStartsAt: z.string().datetime(),
});
export type StaffRescheduleInput = z.infer<typeof staffRescheduleSchema>;
```

Add to `apps/api/src/routes/admin-bookings.ts` (update the schema import line to include `staffRescheduleSchema`):

```typescript
adminBookingsRoute.post("/admin/bookings/:id/reschedule", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = bookingIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = staffRescheduleSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }

  const supabase = c.get("supabaseUser");
  const staffMember = c.get("staffMember");

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (!booking) {
    return c.json({ error: "not_found" }, 404);
  }
  if (FINALIZED_STATUSES.includes(booking.status as (typeof FINALIZED_STATUSES)[number])) {
    return c.json({ error: "already_finalized" }, 409);
  }
  if (!booking.staff_id) {
    return c.json({ error: "slot_unavailable" }, 409);
  }

  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes, buffer_minutes_before, buffer_minutes_after")
    .eq("id", booking.service_id)
    .maybeSingle();
  if (!service) {
    return c.json({ error: "invalid_service" }, 422);
  }

  const newStartsAt = new Date(parsed.data.newStartsAt);
  const newEndsAt = new Date(newStartsAt.getTime() + service.duration_minutes * 60_000);

  const conflict = await hasExistingConflict(supabase, booking.staff_id, newStartsAt, newEndsAt, service, booking.id);
  if (conflict) {
    return c.json({ error: "slot_unavailable" }, 409);
  }

  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({ starts_at: newStartsAt.toISOString(), ends_at: newEndsAt.toISOString() })
    .eq("id", booking.id)
    .select("*")
    .single();
  if (updateError || !updated) {
    const { httpStatus, body } = classifySupabaseError(updateError ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }

  await supabase
    .from("booking_verification_tokens")
    .update({ expires_at: updated.starts_at })
    .eq("booking_id", booking.id)
    .in("purpose", ["cancel", "reschedule"]);

  await supabase.from("audit_log").insert({
    actor_member_id: staffMember.id,
    action: "staff_reschedule",
    target_type: "booking",
    target_id: booking.id,
    before: booking,
    after: updated,
  });

  return c.json({ booking: updated });
});
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-bookings.route.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify the 200 path**

Force-book a fresh test booking (Task 8's curl) to get an id, then:

```bash
curl -s -X POST localhost:8787/admin/bookings/<booking-id>/reschedule -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d '{"newStartsAt": "2026-09-03T10:00:00.000Z"}'
```

Expected: `200`, `{"booking": {"starts_at": "2026-09-03T10:00:00.000Z", ...}}`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-bookings.schema.ts apps/api/src/routes/admin-bookings.ts apps/api/test/admin-bookings.route.test.ts
git commit -m "feat(api): add POST /admin/bookings/:id/reschedule — staff override with audit logging"
```

---

### Task 11: Patients — list/search, detail + history, edit

**Files:**
- Create: `apps/api/src/routes/admin-patients.schema.ts`
- Create: `apps/api/src/routes/admin-patients.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/admin-patients.route.test.ts`

**Interfaces:**
- Consumes: `staffAuthMiddleware`, `tenantMiddleware`, `classifySupabaseError`.
- Produces: `adminPatientsRoute`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-patients.route.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /admin/patients — tenant and auth shape checks", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/admin/patients");
    expect(res.status).toBe(400);
  });

  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/patients", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(401);
  });
});

describe("GET /admin/patients/:id — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/patients/00000000-0000-0000-0000-000000000001", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /admin/patients/:id — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/patients/00000000-0000-0000-0000-000000000001", {
      method: "PATCH",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-patients.route.test.ts`
Expected: FAIL — none of these routes exist yet.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/admin-patients.schema.ts`:

```typescript
import { z } from "zod";

export const listPatientsQuerySchema = z.object({
  q: z.string().min(1).max(200).optional(),
});
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

export const patientIdParamSchema = z.object({ id: z.string().uuid() });

export const updatePatientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(32).optional(),
  notes: z.string().max(5000).optional(),
});
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
```

Create `apps/api/src/routes/admin-patients.ts`:

```typescript
import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { listPatientsQuerySchema, patientIdParamSchema, updatePatientSchema } from "./admin-patients.schema.js";

export const adminPatientsRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminPatientsRoute.get("/admin/patients", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = listPatientsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  let query = supabase.from("patients").select("*").order("created_at", { ascending: false });
  if (parsed.data.q) {
    const q = parsed.data.q;
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  const { data: patients, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ patients: patients ?? [] });
});

adminPatientsRoute.get("/admin/patients/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = patientIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (!patient) {
    return c.json({ error: "not_found" }, 404);
  }
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("patient_id", parsedParams.data.id)
    .order("starts_at", { ascending: false });
  return c.json({ patient, bookings: bookings ?? [] });
});

adminPatientsRoute.patch("/admin/patients/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = patientIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = updatePatientSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: updated, error } = await supabase
    .from("patients")
    .update(parsed.data)
    .eq("id", parsedParams.data.id)
    .select("*")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!updated) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ patient: updated });
});
```

In `apps/api/src/app.ts`:

```typescript
import { adminPatientsRoute } from "./routes/admin-patients.js";
```

```typescript
app.route("/", adminPatientsRoute);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-patients.route.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify all three 2xx paths**

```bash
curl -s "localhost:8787/admin/patients?q=Force" -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
curl -s "localhost:8787/admin/patients/<a-patient-id>" -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
curl -s -X PATCH "localhost:8787/admin/patients/<a-patient-id>" -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{"notes": "Prefers morning appointments"}'
```

Expected: `200` for all three, the PATCH response reflects the new `notes` value.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-patients.schema.ts apps/api/src/routes/admin-patients.ts apps/api/src/app.ts apps/api/test/admin-patients.route.test.ts
git commit -m "feat(api): add patient list/search, detail+history, and edit admin routes"
```

---

### Task 12: Service categories CRUD

**Files:**
- Create: `apps/api/src/routes/admin-service-categories.schema.ts`
- Create: `apps/api/src/routes/admin-service-categories.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/admin-service-categories.route.test.ts`

**Interfaces:**
- Consumes: `upsertTranslations`/`fetchTranslations`/`deleteTranslations` (Task 4).
- Produces: `adminServiceCategoriesRoute`. Establishes the CRUD + translations pattern Tasks 13–14 (services, staff) repeat.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-service-categories.route.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const ROUTES: Array<[string, string]> = [
  ["GET", "/admin/service-categories"],
  ["POST", "/admin/service-categories"],
  ["PATCH", "/admin/service-categories/00000000-0000-0000-0000-000000000001"],
  ["DELETE", "/admin/service-categories/00000000-0000-0000-0000-000000000001"],
];

describe("admin service-categories routes — tenant and auth shape checks", () => {
  it.each(ROUTES)("%s %s 401s with no Authorization header", async (method, path) => {
    const res = await app.request(path, {
      method,
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : "{}",
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-service-categories.route.test.ts`
Expected: FAIL — none of these routes exist yet.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/admin-service-categories.schema.ts`:

```typescript
import { z } from "zod";

const localizedTextSchema = z.record(z.string(), z.string().min(1));

export const categoryIdParamSchema = z.object({ id: z.string().uuid() });

export const createServiceCategorySchema = z.object({
  icon: z.string().max(100).optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  name: localizedTextSchema,
});
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;

export const updateServiceCategorySchema = z.object({
  icon: z.string().max(100).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  name: localizedTextSchema.optional(),
});
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;
```

Create `apps/api/src/routes/admin-service-categories.ts`:

```typescript
import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { deleteTranslations, fetchTranslations, toLocaleMap, upsertTranslations } from "../lib/translations.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import {
  categoryIdParamSchema,
  createServiceCategorySchema,
  updateServiceCategorySchema,
} from "./admin-service-categories.schema.js";

const ENTITY_TYPE = "service_category";

export const adminServiceCategoriesRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminServiceCategoriesRoute.get("/admin/service-categories", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const supabase = c.get("supabaseUser");
  const { data: categories, error } = await supabase
    .from("service_categories")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  const withNames = await Promise.all(
    (categories ?? []).map(async (category) => ({
      ...category,
      name: toLocaleMap(await fetchTranslations(supabase, ENTITY_TYPE, category.id), "name"),
    })),
  );
  return c.json({ serviceCategories: withNames });
});

adminServiceCategoriesRoute.post("/admin/service-categories", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createServiceCategorySchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: category, error } = await supabase
    .from("service_categories")
    .insert({
      icon: parsed.data.icon,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
    })
    .select("*")
    .single();
  if (error || !category) {
    const { httpStatus, body } = classifySupabaseError(error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }
  await upsertTranslations(
    supabase,
    ENTITY_TYPE,
    category.id,
    Object.entries(parsed.data.name).map(([locale, value]) => ({ locale, field: "name", value })),
  );
  return c.json({ serviceCategory: { ...category, name: parsed.data.name } }, 201);
});

adminServiceCategoriesRoute.patch(
  "/admin/service-categories/:id",
  tenantMiddleware,
  staffAuthMiddleware,
  async (c) => {
    const parsedParams = categoryIdParamSchema.safeParse({ id: c.req.param("id") });
    if (!parsedParams.success) {
      return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
    }
    const json = await c.req.json().catch(() => null);
    const parsed = updateServiceCategorySchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
    }
    const supabase = c.get("supabaseUser");
    const { icon, displayOrder, isActive, name } = parsed.data;
    const { data: category, error } = await supabase
      .from("service_categories")
      .update({
        ...(icon !== undefined ? { icon } : {}),
        ...(displayOrder !== undefined ? { display_order: displayOrder } : {}),
        ...(isActive !== undefined ? { is_active: isActive } : {}),
      })
      .eq("id", parsedParams.data.id)
      .select("*")
      .maybeSingle();
    if (error) {
      const { httpStatus, body } = classifySupabaseError(error);
      return c.json(body, httpStatus as 409 | 500);
    }
    if (!category) {
      return c.json({ error: "not_found" }, 404);
    }
    if (name) {
      await upsertTranslations(
        supabase,
        ENTITY_TYPE,
        category.id,
        Object.entries(name).map(([locale, value]) => ({ locale, field: "name", value })),
      );
    }
    // Always re-fetch rather than trust the request body: a PATCH that
    // didn't touch `name` still needs to return it, and this keeps the
    // response shape identical to GET/POST (see toLocaleMap in Task 4).
    const currentName = toLocaleMap(await fetchTranslations(supabase, ENTITY_TYPE, category.id), "name");
    return c.json({ serviceCategory: { ...category, name: currentName } });
  },
);

adminServiceCategoriesRoute.delete(
  "/admin/service-categories/:id",
  tenantMiddleware,
  staffAuthMiddleware,
  async (c) => {
    const parsedParams = categoryIdParamSchema.safeParse({ id: c.req.param("id") });
    if (!parsedParams.success) {
      return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
    }
    const supabase = c.get("supabaseUser");
    const { data: deleted, error } = await supabase
      .from("service_categories")
      .delete()
      .eq("id", parsedParams.data.id)
      .select("id")
      .maybeSingle();
    if (error) {
      const { httpStatus, body } = classifySupabaseError(error);
      return c.json(body, httpStatus as 409 | 500);
    }
    if (!deleted) {
      return c.json({ error: "not_found" }, 404);
    }
    await deleteTranslations(supabase, ENTITY_TYPE, parsedParams.data.id);
    return c.body(null, 204);
  },
);
```

In `apps/api/src/app.ts`:

```typescript
import { adminServiceCategoriesRoute } from "./routes/admin-service-categories.js";
```

```typescript
app.route("/", adminServiceCategoriesRoute);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-service-categories.route.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify create → list → update → delete**

```bash
curl -s -X POST localhost:8787/admin/service-categories -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d '{"icon": "tooth", "name": {"en": "Preventive Care", "lv": "Profilaktiskā aprūpe", "ru": "Профилактика"}}'
# Grab the returned id, then:
curl -s localhost:8787/admin/service-categories -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
curl -s -X PATCH localhost:8787/admin/service-categories/<id> -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{"isActive": false}'
curl -s -X DELETE localhost:8787/admin/service-categories/<id> -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
```

Expected: `201`, `200`, `200`, `204` in order; the list response includes the translated `name` object.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-service-categories.schema.ts apps/api/src/routes/admin-service-categories.ts apps/api/src/app.ts apps/api/test/admin-service-categories.route.test.ts
git commit -m "feat(api): add service_categories admin CRUD with translations"
```

---

### Task 13: Services CRUD

**Files:**
- Create: `apps/api/src/routes/admin-services.schema.ts`
- Create: `apps/api/src/routes/admin-services.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/admin-services.route.test.ts`

**Interfaces:**
- Consumes: `upsertTranslations`/`fetchTranslations`/`deleteTranslations` (Task 4). Same CRUD + translations shape as Task 12, applied to `services` (two translated fields — `name` and `description` — instead of one).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-services.route.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const ROUTES: Array<[string, string]> = [
  ["GET", "/admin/services"],
  ["POST", "/admin/services"],
  ["PATCH", "/admin/services/00000000-0000-0000-0000-000000000001"],
  ["DELETE", "/admin/services/00000000-0000-0000-0000-000000000001"],
];

describe("admin services routes — tenant and auth shape checks", () => {
  it.each(ROUTES)("%s %s 401s with no Authorization header", async (method, path) => {
    const res = await app.request(path, {
      method,
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : "{}",
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-services.route.test.ts`
Expected: FAIL — none of these routes exist yet.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/admin-services.schema.ts`:

```typescript
import { z } from "zod";

const localizedTextSchema = z.record(z.string(), z.string().min(1));

export const serviceIdParamSchema = z.object({ id: z.string().uuid() });

export const createServiceSchema = z.object({
  categoryId: z.string().uuid().optional(),
  durationMinutes: z.number().int().positive(),
  bufferMinutesBefore: z.number().int().nonnegative().default(0),
  bufferMinutesAfter: z.number().int().nonnegative().default(0),
  priceAmount: z.number().nonnegative().optional(),
  priceCurrency: z.string().length(3).default("EUR"),
  pricePrefix: z.enum(["exact", "from", "up_to"]).default("exact"),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  name: localizedTextSchema,
  description: localizedTextSchema.optional(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
  bufferMinutesBefore: z.number().int().nonnegative().optional(),
  bufferMinutesAfter: z.number().int().nonnegative().optional(),
  priceAmount: z.number().nonnegative().nullable().optional(),
  priceCurrency: z.string().length(3).optional(),
  pricePrefix: z.enum(["exact", "from", "up_to"]).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  name: localizedTextSchema.optional(),
  description: localizedTextSchema.optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
```

Create `apps/api/src/routes/admin-services.ts`:

```typescript
import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { deleteTranslations, fetchTranslations, toLocaleMap, upsertTranslations } from "../lib/translations.js";
import type { TypedSupabaseClient } from "../lib/supabase.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { createServiceSchema, serviceIdParamSchema, updateServiceSchema } from "./admin-services.schema.js";

const ENTITY_TYPE = "service";

function translationEntries(fields: { name?: Record<string, string>; description?: Record<string, string> }) {
  const entries: { locale: string; field: string; value: string }[] = [];
  for (const [locale, value] of Object.entries(fields.name ?? {})) {
    entries.push({ locale, field: "name", value });
  }
  for (const [locale, value] of Object.entries(fields.description ?? {})) {
    entries.push({ locale, field: "description", value });
  }
  return entries;
}

// Same { locale: value } shape on GET/POST/PATCH for both translated
// fields — mirrors admin-service-categories.ts's toLocaleMap usage.
async function withText<T extends { id: string }>(supabase: TypedSupabaseClient, service: T) {
  const rows = await fetchTranslations(supabase, ENTITY_TYPE, service.id);
  return { ...service, name: toLocaleMap(rows, "name"), description: toLocaleMap(rows, "description") };
}

export const adminServicesRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminServicesRoute.get("/admin/services", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const supabase = c.get("supabaseUser");
  const { data: services, error } = await supabase
    .from("services")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  const withTranslations = await Promise.all((services ?? []).map((service) => withText(supabase, service)));
  return c.json({ services: withTranslations });
});

adminServicesRoute.post("/admin/services", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createServiceSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: service, error } = await supabase
    .from("services")
    .insert({
      category_id: input.categoryId,
      duration_minutes: input.durationMinutes,
      buffer_minutes_before: input.bufferMinutesBefore,
      buffer_minutes_after: input.bufferMinutesAfter,
      price_amount: input.priceAmount,
      price_currency: input.priceCurrency,
      price_prefix: input.pricePrefix,
      display_order: input.displayOrder,
      is_active: input.isActive,
    })
    .select("*")
    .single();
  if (error || !service) {
    const { httpStatus, body } = classifySupabaseError(error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }
  await upsertTranslations(
    supabase,
    ENTITY_TYPE,
    service.id,
    translationEntries({ name: input.name, description: input.description }),
  );
  return c.json({ service: await withText(supabase, service) }, 201);
});

adminServicesRoute.patch("/admin/services/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = serviceIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = updateServiceSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: service, error } = await supabase
    .from("services")
    .update({
      ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
      ...(input.durationMinutes !== undefined ? { duration_minutes: input.durationMinutes } : {}),
      ...(input.bufferMinutesBefore !== undefined ? { buffer_minutes_before: input.bufferMinutesBefore } : {}),
      ...(input.bufferMinutesAfter !== undefined ? { buffer_minutes_after: input.bufferMinutesAfter } : {}),
      ...(input.priceAmount !== undefined ? { price_amount: input.priceAmount } : {}),
      ...(input.priceCurrency !== undefined ? { price_currency: input.priceCurrency } : {}),
      ...(input.pricePrefix !== undefined ? { price_prefix: input.pricePrefix } : {}),
      ...(input.displayOrder !== undefined ? { display_order: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq("id", parsedParams.data.id)
    .select("*")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!service) {
    return c.json({ error: "not_found" }, 404);
  }
  const entries = translationEntries({ name: input.name, description: input.description });
  if (entries.length > 0) {
    await upsertTranslations(supabase, ENTITY_TYPE, service.id, entries);
  }
  return c.json({ service: await withText(supabase, service) });
});

adminServicesRoute.delete("/admin/services/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = serviceIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: deleted, error } = await supabase
    .from("services")
    .delete()
    .eq("id", parsedParams.data.id)
    .select("id")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!deleted) {
    return c.json({ error: "not_found" }, 404);
  }
  await deleteTranslations(supabase, ENTITY_TYPE, parsedParams.data.id);
  return c.body(null, 204);
});
```

In `apps/api/src/app.ts`:

```typescript
import { adminServicesRoute } from "./routes/admin-services.js";
```

```typescript
app.route("/", adminServicesRoute);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-services.route.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify create → list → update → delete**

```bash
curl -s -X POST localhost:8787/admin/services -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{
  "durationMinutes": 30,
  "priceAmount": 45,
  "name": {"en": "Checkup", "lv": "Pārbaude", "ru": "Осмотр"}
}'
```

Expected: `201` with the new service row; follow with list/update/delete curls mirroring Task 12's Step 6, confirming `200`/`200`/`204`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-services.schema.ts apps/api/src/routes/admin-services.ts apps/api/src/app.ts apps/api/test/admin-services.route.test.ts
git commit -m "feat(api): add services admin CRUD with translations"
```

---

### Task 14: Staff CRUD + `staff_services` linking

**Files:**
- Create: `apps/api/src/routes/admin-staff.schema.ts`
- Create: `apps/api/src/routes/admin-staff.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/admin-staff.route.test.ts`

**Interfaces:**
- Consumes: `upsertTranslations`/`fetchTranslations`/`deleteTranslations` (Task 4).
- Produces: `adminStaffRoute`, including `PUT /admin/staff/:id/services` which replaces a staff member's full set of bookable services (delete-then-insert, not a diff — a small non-atomic window between the two statements is an accepted MVP limitation, consistent with this project's existing tolerance for similar tradeoffs elsewhere).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-staff.route.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const ROUTES: Array<[string, string]> = [
  ["GET", "/admin/staff"],
  ["POST", "/admin/staff"],
  ["PATCH", "/admin/staff/00000000-0000-0000-0000-000000000001"],
  ["DELETE", "/admin/staff/00000000-0000-0000-0000-000000000001"],
  ["PUT", "/admin/staff/00000000-0000-0000-0000-000000000001/services"],
];

describe("admin staff routes — tenant and auth shape checks", () => {
  it.each(ROUTES)("%s %s 401s with no Authorization header", async (method, path) => {
    const res = await app.request(path, {
      method,
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : "{}",
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-staff.route.test.ts`
Expected: FAIL — none of these routes exist yet.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/admin-staff.schema.ts`:

```typescript
import { z } from "zod";

const localizedTextSchema = z.record(z.string(), z.string().min(1));

export const staffIdParamSchema = z.object({ id: z.string().uuid() });

export const createStaffSchema = z.object({
  name: z.string().min(1).max(200),
  photoUrl: z.string().url().optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isBookable: z.boolean().default(true),
  bio: localizedTextSchema.optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  photoUrl: z.string().url().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isBookable: z.boolean().optional(),
  bio: localizedTextSchema.optional(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const replaceStaffServicesSchema = z.object({
  serviceIds: z.array(z.string().uuid()),
});
export type ReplaceStaffServicesInput = z.infer<typeof replaceStaffServicesSchema>;
```

Create `apps/api/src/routes/admin-staff.ts`:

```typescript
import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { deleteTranslations, fetchTranslations, toLocaleMap, upsertTranslations } from "../lib/translations.js";
import type { TypedSupabaseClient } from "../lib/supabase.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import {
  createStaffSchema,
  replaceStaffServicesSchema,
  staffIdParamSchema,
  updateStaffSchema,
} from "./admin-staff.schema.js";

const ENTITY_TYPE = "staff";

// Same { locale: value } shape on GET/POST/PATCH — mirrors
// admin-service-categories.ts's and admin-services.ts's toLocaleMap usage.
async function withBio<T extends { id: string }>(supabase: TypedSupabaseClient, member: T) {
  const rows = await fetchTranslations(supabase, ENTITY_TYPE, member.id);
  return { ...member, bio: toLocaleMap(rows, "bio") };
}

export const adminStaffRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminStaffRoute.get("/admin/staff", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const supabase = c.get("supabaseUser");
  const { data: staff, error } = await supabase
    .from("staff")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  const withTranslations = await Promise.all((staff ?? []).map((member) => withBio(supabase, member)));
  return c.json({ staff: withTranslations });
});

adminStaffRoute.post("/admin/staff", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createStaffSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: staffRow, error } = await supabase
    .from("staff")
    .insert({
      name: input.name,
      photo_url: input.photoUrl,
      display_order: input.displayOrder,
      is_active: input.isActive,
      is_bookable: input.isBookable,
    })
    .select("*")
    .single();
  if (error || !staffRow) {
    const { httpStatus, body } = classifySupabaseError(error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }
  if (input.bio) {
    await upsertTranslations(
      supabase,
      ENTITY_TYPE,
      staffRow.id,
      Object.entries(input.bio).map(([locale, value]) => ({ locale, field: "bio", value })),
    );
  }
  return c.json({ staff: await withBio(supabase, staffRow) }, 201);
});

adminStaffRoute.patch("/admin/staff/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = staffIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = updateStaffSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: staffRow, error } = await supabase
    .from("staff")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.photoUrl !== undefined ? { photo_url: input.photoUrl } : {}),
      ...(input.displayOrder !== undefined ? { display_order: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.isBookable !== undefined ? { is_bookable: input.isBookable } : {}),
    })
    .eq("id", parsedParams.data.id)
    .select("*")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!staffRow) {
    return c.json({ error: "not_found" }, 404);
  }
  if (input.bio) {
    await upsertTranslations(
      supabase,
      ENTITY_TYPE,
      staffRow.id,
      Object.entries(input.bio).map(([locale, value]) => ({ locale, field: "bio", value })),
    );
  }
  return c.json({ staff: await withBio(supabase, staffRow) });
});

adminStaffRoute.delete("/admin/staff/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = staffIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: deleted, error } = await supabase
    .from("staff")
    .delete()
    .eq("id", parsedParams.data.id)
    .select("id")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!deleted) {
    return c.json({ error: "not_found" }, 404);
  }
  await deleteTranslations(supabase, ENTITY_TYPE, parsedParams.data.id);
  return c.body(null, 204);
});

adminStaffRoute.put("/admin/staff/:id/services", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = staffIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parsed = replaceStaffServicesSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const staffId = parsedParams.data.id;

  const { error: deleteError } = await supabase.from("staff_services").delete().eq("staff_id", staffId);
  if (deleteError) {
    const { httpStatus, body } = classifySupabaseError(deleteError);
    return c.json(body, httpStatus as 409 | 500);
  }

  if (parsed.data.serviceIds.length === 0) {
    return c.json({ staffServices: [] });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("staff_services")
    .insert(parsed.data.serviceIds.map((serviceId) => ({ staff_id: staffId, service_id: serviceId })))
    .select("*");
  if (insertError) {
    const { httpStatus, body } = classifySupabaseError(insertError);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ staffServices: inserted ?? [] });
});
```

In `apps/api/src/app.ts`:

```typescript
import { adminStaffRoute } from "./routes/admin-staff.js";
```

```typescript
app.route("/", adminStaffRoute);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-staff.route.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify create → list → update → link services → delete**

```bash
curl -s -X POST localhost:8787/admin/staff -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "Dr. Test Dentist"}'
# Grab the returned id, then:
curl -s -X PUT localhost:8787/admin/staff/<id>/services -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d '{"serviceIds": ["<a-real-service-id>"]}'
curl -s localhost:8787/admin/staff -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
curl -s -X DELETE localhost:8787/admin/staff/<id> -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
```

Expected: `201`, `200`, `200`, `204` in order.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-staff.schema.ts apps/api/src/routes/admin-staff.ts apps/api/src/app.ts apps/api/test/admin-staff.route.test.ts
git commit -m "feat(api): add staff admin CRUD with translations and staff_services linking"
```

---

### Task 15: `business_hours` — get/replace

**Files:**
- Create: `apps/api/src/routes/admin-business-hours.schema.ts`
- Create: `apps/api/src/routes/admin-business-hours.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/admin-business-hours.route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `adminBusinessHoursRoute`. This is the "updating service hours" requirement — `GET` returns the current week (business-wide default, or one staff member's override), `PUT` replaces the whole week in one call (delete-then-insert, same accepted-limitation note as Task 14's `staff_services` linking).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-business-hours.route.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /admin/business-hours — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/business-hours", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(401);
  });
});

describe("PUT /admin/business-hours — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/business-hours", {
      method: "PUT",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-business-hours.route.test.ts`
Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/admin-business-hours.schema.ts`:

```typescript
import { z } from "zod";

export const businessHoursQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
});
export type BusinessHoursQuery = z.infer<typeof businessHoursQuerySchema>;

const hourEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable(),
  closesAt: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable(),
  isClosed: z.boolean().default(false),
});

export const replaceBusinessHoursSchema = z.object({
  staffId: z.string().uuid().nullable(),
  hours: z.array(hourEntrySchema).min(1).max(7),
});
export type ReplaceBusinessHoursInput = z.infer<typeof replaceBusinessHoursSchema>;
```

Create `apps/api/src/routes/admin-business-hours.ts`:

```typescript
import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { businessHoursQuerySchema, replaceBusinessHoursSchema } from "./admin-business-hours.schema.js";

export const adminBusinessHoursRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminBusinessHoursRoute.get("/admin/business-hours", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = businessHoursQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  let query = supabase.from("business_hours").select("*").order("day_of_week", { ascending: true });
  query = parsed.data.staffId ? query.eq("staff_id", parsed.data.staffId) : query.is("staff_id", null);
  const { data: hours, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ businessHours: hours ?? [] });
});

adminBusinessHoursRoute.put("/admin/business-hours", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = replaceBusinessHoursSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { staffId, hours } = parsed.data;

  let deleteQuery = supabase.from("business_hours").delete();
  deleteQuery = staffId ? deleteQuery.eq("staff_id", staffId) : deleteQuery.is("staff_id", null);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    const { httpStatus, body } = classifySupabaseError(deleteError);
    return c.json(body, httpStatus as 409 | 500);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("business_hours")
    .insert(
      hours.map((h) => ({
        staff_id: staffId,
        day_of_week: h.dayOfWeek,
        opens_at: h.opensAt,
        closes_at: h.closesAt,
        is_closed: h.isClosed,
      })),
    )
    .select("*");
  if (insertError) {
    const { httpStatus, body } = classifySupabaseError(insertError);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ businessHours: inserted ?? [] });
});
```

In `apps/api/src/app.ts`:

```typescript
import { adminBusinessHoursRoute } from "./routes/admin-business-hours.js";
```

```typescript
app.route("/", adminBusinessHoursRoute);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-business-hours.route.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify get and replace**

```bash
curl -s localhost:8787/admin/business-hours -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
curl -s -X PUT localhost:8787/admin/business-hours -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{
  "staffId": null,
  "hours": [
    {"dayOfWeek": 1, "opensAt": "09:00", "closesAt": "18:00", "isClosed": false},
    {"dayOfWeek": 2, "opensAt": "09:00", "closesAt": "18:00", "isClosed": false},
    {"dayOfWeek": 3, "opensAt": "09:00", "closesAt": "18:00", "isClosed": false},
    {"dayOfWeek": 4, "opensAt": "09:00", "closesAt": "18:00", "isClosed": false},
    {"dayOfWeek": 5, "opensAt": "09:00", "closesAt": "18:00", "isClosed": false},
    {"dayOfWeek": 6, "opensAt": null, "closesAt": null, "isClosed": true},
    {"dayOfWeek": 0, "opensAt": null, "closesAt": null, "isClosed": true}
  ]
}'
```

Expected: `200` for both; a follow-up `GET` reflects the newly replaced week. **Caution:** this replaces Dent Di's real business-wide hours seed data — re-run the seed or restore the original 7 rows afterward if this is run against the live project outside a disposable test window.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-business-hours.schema.ts apps/api/src/routes/admin-business-hours.ts apps/api/src/app.ts apps/api/test/admin-business-hours.route.test.ts
git commit -m "feat(api): add business_hours admin get/replace routes"
```

---

### Task 16: `closures` CRUD

**Files:**
- Create: `apps/api/src/routes/admin-closures.schema.ts`
- Create: `apps/api/src/routes/admin-closures.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/admin-closures.route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `adminClosuresRoute`. Editing an existing closure is delete-then-recreate (no `PATCH`) — consistent MVP scope with the rest of this plan; there's no requirement anywhere in `PROJECT_CONTEXT.md` for in-place closure editing.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-closures.route.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const ROUTES: Array<[string, string]> = [
  ["GET", "/admin/closures"],
  ["POST", "/admin/closures"],
  ["DELETE", "/admin/closures/00000000-0000-0000-0000-000000000001"],
];

describe("admin closures routes — tenant and auth shape checks", () => {
  it.each(ROUTES)("%s %s 401s with no Authorization header", async (method, path) => {
    const res = await app.request(path, {
      method,
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : "{}",
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/admin-closures.route.test.ts`
Expected: FAIL — none of these routes exist yet.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/admin-closures.schema.ts`:

```typescript
import { z } from "zod";

export const listClosuresQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
});
export type ListClosuresQuery = z.infer<typeof listClosuresQuerySchema>;

export const createClosureSchema = z.object({
  staffId: z.string().uuid().nullable(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional(),
  isRecurringYearly: z.boolean().default(false),
});
export type CreateClosureInput = z.infer<typeof createClosureSchema>;

export const closureIdParamSchema = z.object({ id: z.string().uuid() });
```

Create `apps/api/src/routes/admin-closures.ts`:

```typescript
import { Hono } from "hono";
import { classifySupabaseError } from "../lib/pg-errors.js";
import { staffAuthMiddleware, type StaffAuthVariables } from "../middleware/staffAuth.js";
import { tenantMiddleware, type TenantVariables } from "../middleware/tenant.js";
import { closureIdParamSchema, createClosureSchema, listClosuresQuerySchema } from "./admin-closures.schema.js";

export const adminClosuresRoute = new Hono<{ Variables: TenantVariables & StaffAuthVariables }>();

adminClosuresRoute.get("/admin/closures", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsed = listClosuresQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  let query = supabase.from("closures").select("*").order("starts_on", { ascending: true });
  if (parsed.data.staffId) {
    query = query.eq("staff_id", parsed.data.staffId);
  }
  const { data: closures, error } = await query;
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ closures: closures ?? [] });
});

adminClosuresRoute.post("/admin/closures", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createClosureSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.issues }, 400);
  }
  const input = parsed.data;
  const supabase = c.get("supabaseUser");
  const { data: closure, error } = await supabase
    .from("closures")
    .insert({
      staff_id: input.staffId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      reason: input.reason,
      is_recurring_yearly: input.isRecurringYearly,
    })
    .select("*")
    .single();
  if (error || !closure) {
    const { httpStatus, body } = classifySupabaseError(error ?? {});
    return c.json(body, httpStatus as 409 | 500);
  }
  return c.json({ closure }, 201);
});

adminClosuresRoute.delete("/admin/closures/:id", tenantMiddleware, staffAuthMiddleware, async (c) => {
  const parsedParams = closureIdParamSchema.safeParse({ id: c.req.param("id") });
  if (!parsedParams.success) {
    return c.json({ error: "validation_error", details: parsedParams.error.issues }, 400);
  }
  const supabase = c.get("supabaseUser");
  const { data: deleted, error } = await supabase
    .from("closures")
    .delete()
    .eq("id", parsedParams.data.id)
    .select("id")
    .maybeSingle();
  if (error) {
    const { httpStatus, body } = classifySupabaseError(error);
    return c.json(body, httpStatus as 409 | 500);
  }
  if (!deleted) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.body(null, 204);
});
```

In `apps/api/src/app.ts`:

```typescript
import { adminClosuresRoute } from "./routes/admin-closures.js";
```

```typescript
app.route("/", adminClosuresRoute);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/admin-closures.route.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean.

- [ ] **Step 6 (LIVE): Verify create → list → delete**

```bash
curl -s -X POST localhost:8787/admin/closures -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d '{"staffId": null, "startsOn": "2026-12-24", "endsOn": "2026-12-26", "reason": "Christmas", "isRecurringYearly": true}'
curl -s localhost:8787/admin/closures -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
curl -s -X DELETE localhost:8787/admin/closures/<id> -H "X-Tenant-Slug: dentdi" -H "Authorization: Bearer $OWNER_TOKEN"
```

Expected: `201`, `200`, `204` in order.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin-closures.schema.ts apps/api/src/routes/admin-closures.ts apps/api/src/app.ts apps/api/test/admin-closures.route.test.ts
git commit -m "feat(api): add closures admin CRUD"
```

---

### Task 17: Full live verification pass + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** None — documentation and final sign-off only.

- [ ] **Step 1: Run the full test suite and typecheck one last time**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm run test`
Expected: clean, every test from Tasks 1–16 passing together (not just per-task in isolation).

- [ ] **Step 2 (LIVE): Re-run every LIVE step from Tasks 1–16 in one pass**

Confirms nothing in a later task broke an earlier one's live behavior (e.g. the `hasExistingConflict` refactor in Task 8 touching the public `/bookings` routes). Use the checklist below; every row should return the status noted in its originating task.

| Route | Method | Expected |
|---|---|---|
| `/availability` → `/bookings` → `/bookings/confirm` → `/bookings/cancel` | (Task 1) | full status transition |
| `/admin/me` | GET | 200 |
| `/admin/bookings` | GET | 200 |
| `/admin/bookings` (force-book) | POST | 201 + audit_log row |
| `/admin/bookings/:id/cancel` | POST | 200 + audit_log row |
| `/admin/bookings/:id/reschedule` | POST | 200 + audit_log row |
| `/admin/patients`, `/admin/patients/:id`, `PATCH /admin/patients/:id` | GET/GET/PATCH | 200 each |
| `/admin/service-categories` CRUD | GET/POST/PATCH/DELETE | 200/201/200/204 |
| `/admin/services` CRUD | GET/POST/PATCH/DELETE | 200/201/200/204 |
| `/admin/staff` CRUD + `/admin/staff/:id/services` | GET/POST/PATCH/DELETE/PUT | 200/201/200/204/200 |
| `/admin/business-hours` | GET/PUT | 200/200 |
| `/admin/closures` CRUD | GET/POST/DELETE | 200/201/204 |

- [ ] **Step 3: Update CLAUDE.md**

Add a new checklist entry under "Current Build Stage" (after the most recent `[x]` entry) summarizing what this plan built — staff auth via Supabase Auth + `staffAuthMiddleware`, the RLS-as-authorization-boundary architecture decision, and the full route list added. Mark the pre-existing "Admin-side booking management ... is deferred" bullet under "Open / Non-Blocking Items" as done, replacing it with a pointer to this plan's routes. Add a new Decisions Log row: `Admin/staff data-access pattern | Admin routes use a per-request Supabase client scoped to the staff member's own JWT (anon key + Authorization forwarding), relying on existing RLS (is_active_member()) as the real authorization boundary — not the service-role key. staffAuthMiddleware's one service-role read (business_members status) exists only to turn "RLS returns zero rows" into a clean 401/403.`

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record staff/admin backend build-out and live verification"
```
