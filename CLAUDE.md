# Dent Di Booking Platform — Project Memory

This file is living memory for Claude Code sessions in this repo. Update it
as decisions are made or build stage changes — don't let it go stale.
Background/rationale that doesn't change often lives in `PROJECT_CONTEXT.md`;
this file tracks current state and active decisions.

## Role & Product

Solo developer's technical co-builder on a multi-tenant SaaS platform for
small service businesses (dental/medical practices, groomers, hairdressers,
salons) — a marketing website + booking system configured per business
through data, not forked code. Favor pragmatic, maintainable decisions over
theoretically "perfect" ones. First client: **Dent Di** (dentdi.lv), a
Latvian dental clinic with 2 staff (1 dentist, 1 nurse).

## ⚠️ CRITICAL ARCHITECTURE NOTE — READ FIRST

This platform was originally scoped as **one shared multi-tenant Supabase
project** with `business_id` on every table and RLS enforcing tenant
isolation. **That was superseded mid-planning.** The current, correct
architecture is:

> **One dedicated Supabase project per client** — full isolation (separate
> database, separate Auth, separate everything). Not a shared DB with
> row-level scoping.

If you see any reference to a shared `businesses` table with `business_id`
scoping, that's the superseded design — use the per-tenant model instead.
See `PROJECT_CONTEXT.md` for full rationale.

## Tech Stack (decided)

- **Site generator:** Astro — islands architecture, not a SPA.
- **Database:** Supabase (Postgres + RLS + Auth + Storage) — one project
  per client.
- **Backend/API:** Hono, deployed serverless (Cloudflare Workers or
  Vercel — not yet decided), single deployment, holding a tenant registry
  that routes each request to the correct tenant's Supabase project.
- **Cron/reconciliation:** Supabase Edge Functions (Deno) via `pg_cron`,
  backstop only — primary availability recalculation is event-driven
  (DB trigger → webhook).
- **Calendar sync (deferred):** Google Calendar API, Microsoft Graph,
  CalDAV.
- **i18n:** Astro i18n routing + versioned locale JSON for static UI
  strings; tenant-authored content lives in Supabase `translations` table.
- **Styling:** Tailwind, token-driven theming via CSS custom properties.

Full architecture principles, security requirements, and i18n/theming
detail: see `PROJECT_CONTEXT.md`.

## Schema State

- `db/tenant-schema.sql` — **current, correct version.** Per-tenant-project
  schema, no `business_id` columns anywhere. This is the migration template
  applied once to each new client's dedicated Supabase project.
- No shared multi-tenant `schema.sql` exists in this repo (that version is
  fully superseded — don't recreate it).

## Current Build Stage

- [x] Architecture decided (per-tenant Supabase), `db/tenant-schema.sql`
      finalized, repo scaffolded.
- [x] Dent Di Supabase project provisioned (`eafeskigfcinnwahjiyx`,
      eu-west-1, Postgres 17) and schema applied via Supabase MCP
      `apply_migration` — not the local CLI flow originally planned; no
      `supabase/migrations` dir exists yet in-repo, revisit before
      client #2. `business_profile`/`roles` seeded.
- [x] Faker-based seed script (`db/seed/generate-seed.ts`, deterministic)
      generates `db/seed.sql`; applied live via MCP `execute_sql`.
      `db/seed/purge.sql` clears it before real client data.
- [x] DB-level schema test suite `db/tests/schema_tests.sql`, 17/17
      passing (run manually via MCP; not yet wired into CI — needs Hono
      env creds, see below). Covers constraints, cascades, RLS/access
      control.
      - **Public catalog reads:** resolved as direct Supabase REST +
        anon key, not proxied through Hono — scoped `GRANT SELECT` to
        `anon` on 5 catalog tables only, `is_active=true` policies.
        Writes stay entirely behind Hono + the service role key.
      - **Bug found & fixed:** `authenticated` role had zero
        table-level GRANTs (RLS policies assumed grants that were never
        issued) — would have broken the entire staff/admin backend from
        day one. Fixed and baked into `db/tenant-schema.sql`.
- [x] Hono API scaffolded at `apps/api` (pnpm workspace). `env.ts` (zod),
      `tenant-registry.ts` (in-memory, header-based `X-Tenant-Slug`),
      `supabase.ts` (service-role/anon clients, explicit `TenantConfig`
      per call), `GET /health`, prod-gated `GET /_smoke/business-profile`.
- [x] TypeScript types generated from the live schema
      (`apps/api/src/lib/database.types.ts` via Supabase MCP) —
      regenerate after any schema change.
- [x] Booking creation: `GET /availability`, `POST /bookings`,
      `POST /bookings/confirm`.
      - Availability calc (`src/lib/availability.ts`): staff-specific vs.
        business-wide hours, closures (incl. recurring-yearly
        wraparound), buffer-aware conflict detection, min lead time.
        `timezone.ts` uses the built-in Intl API (documented DST-edge
        approximation, fine at 15-min granularity).
      - Idempotency via client-supplied key + DB unique constraint.
        Patient find-or-create by email/phone (most-recent wins on
        ambiguity — accepted MVP debt). Double opt-in via signed sha256
        token, 30min TTL.
      - **Double-booking race fixed for real:** `bookings_no_overlap`
        exclusion constraint (`btree_gist`) applied live + baked into
        the schema. Not buffer-aware — `hasBufferConflict()` is still
        the actual buffer enforcement.
      - Notification delivery stubbed (no provider chosen yet);
        `_dev_confirm_url` gated by a hard `NODE_ENV !== "production"`
        check. Rate limiting (in-memory) + Turnstile (env-gated, fails
        closed) are structurally correct but insufficient once deployed
        serverless (see Open Items).
      - 60/60 vitest passing. **Not verified live** (DB-touching paths)
        — this sandbox's network egress blocks `*.supabase.co`; run
        locally with the real `DENTDI_SUPABASE_SECRET_KEY`.
- [x] `POST /bookings/cancel` / `POST /bookings/reschedule`.
      Capability-token model (not single-use — validity from
      `expires_at`/booking `status`, not `used_at`), issued at confirm
      time, refreshed (not reissued) on reschedule. Reschedule reuses
      `hasExistingConflict` with an `excludeBookingId` param. 60/60
      vitest passing, not verified live (same sandbox restriction).
- [ ] Automated DB tests (vitest + supabase-js) — blocked on real
      env-based Supabase credentials existing for the Hono API project.
- [x] **Bug found & fixed:** `TURNSTILE_ENABLED` env parsing used
      `z.coerce.boolean()`, which coerced the literal string `"false"`
      to `true` — silently enabled Turnstile with no secret key
      configured, failing closed on every booking. Fixed with an
      explicit string transform.
- [x] Staff/admin backend: Supabase-Auth-based staff login (no Hono
      login endpoint — the future frontend calls `supabase-js`'s
      `signInWithPassword` directly) + full `/admin/*` route set.
      - Every `/admin/*` route: `tenantMiddleware` → `staffAuthMiddleware`
        → a user-scoped Supabase client (anon key + the staff member's
        own JWT). RLS (`is_active_member()`) is the real authorization
        boundary, not app logic. `staffAuthMiddleware`'s one
        service-role read exists only to turn "RLS returns zero rows"
        into a clean 401/403.
      - Routes: `GET /admin/me`; bookings list/force-book/cancel/
        reschedule; patients list/detail/edit; `service_categories`/
        `services`/`staff` CRUD + `staff_services` linking (translated
        fields via shared `src/lib/translations.ts`); `business_hours`;
        `closures`. Manual overrides write one `audit_log` row each.
      - 102/102 vitest passing. **Partially verified live:** the owner
        account (`owner@dentdi.lv`, `business_members.status = active`,
        role `owner`) was bootstrapped and confirmed via a direct SQL
        read against the live project (2026-08-23). The full 2xx-path
        curl/browser sequence for every route is still not verified —
        needs a human to log in locally with the real owner password.
- [x] `apps/admin` foundation + Bookings screen built (Astro SSR + React
      islands, staff-facing back office). CORS added to `apps/api`
      (`ADMIN_APP_ORIGIN`-gated, `/admin/*` only). Supabase-Auth-based
      SSR login via `@supabase/ssr` — middleware checks the session on
      every non-public request and redirects to `/login`, no Hono login
      endpoint. Bookings screen (list + status/staff/date filters,
      force-book, cancel, reschedule) consumes the existing
      `/admin/bookings*` routes via a typed fetch client
      (`src/lib/api/`). Plan:
      `docs/superpowers/plans/2026-08-22-back-office-admin-ui.md`.
      13/13 vitest passing, `tsc --noEmit`/`astro check` clean. **Not
      verified live** — same reason as above. Deferred, not dropped: a
      calendar view (list view only this pass), Patients/Catalog CRUD
      UI, and Paytraq receipt UI — each its own follow-up plan reusing
      this foundation.
## Decisions Log (running — append, don't rewrite history)

| Area | Decision |
|---|---|
| Locales at launch | LV + RU + EN |
| Visual design | Sage/cream palette, Georgia serif headings |
| Payment at booking | None — pay at clinic |
| Admin chat widget | Rule-based/scripted FAQ bot, not AI/LLM |
| Notification channels | Email + SMS |
| WordPress cutover | Decommissioned at launch, no parallel run |
| Theme tokens | Set by developer during onboarding; no client-facing editor |
| Staff roles | Real `roles` table, seeded `owner`/`staff` |
| Receipts/invoicing | Not built in-house — Paytraq integration, manual trigger |
| Post-launch priority order | 1. Paytraq → 2. configurable booking-form fields → 3. calendar sync |
| Backend/API pattern | Hono, serverless, single deployment |
| Database architecture | One Supabase project per client |
| Dev/testing approach | No UI yet — curl/Postman. Faker seed script; purge before real release |
| GDPR / data residency | Supabase project region must be explicit EU (e.g. Frankfurt) |
| Backend hosting | **Open** — Cloudflare Workers vs. Vercel not yet decided |
| SMS provider | **Open** — not yet chosen (Twilio vs. EU-based alternative) |
| Public catalog reads | Direct via Supabase REST with anon key (scoped GRANT+RLS on services/service_categories/staff/business_hours/translations only), not proxied through Hono — nothing in the catalog is sensitive, so the extra hop bought no security. No client-side "identification token" — anything shipped in browser JS is public and can't function as a secret. |
| Monorepo layout | Originally npm workspaces (`"workspaces": ["apps/*"]`); **swapped to pnpm workspaces** (root `pnpm-workspace.yaml`, `package.json`'s `workspaces` field removed, `package-lock.json` dropped in favor of a single root `pnpm-lock.yaml`) — npm isn't installed in the dev environment this project is actually built from, pnpm is. `apps/api` added for Hono. `db/` stays at repo root for now — deliberate half-step, not permanent; revisit if it starts feeling inconsistent once `apps/site` (Astro) exists too |
| Hono local dev | `@hono/node-server` + `tsx watch` for local dev; no `wrangler.toml`/Vercel config yet — keeps the Backend hosting decision above genuinely open, since Hono's runtime-agnostic adapter pattern makes adding either later a small additive file, not a rewrite |
| Tenant resolution (interim) | Header-based (`X-Tenant-Slug`) + in-memory env-var-driven registry map (`resolveTenant(slug)` in `apps/api/src/config/tenant-registry.ts`), not DB-backed. Fine for 1–3 clients; should get replaced by a real registry around the same time client #2 forces the migration-runner question (see note below the build-stage checklist) |
| Double-booking prevention | Fixed for real via a Postgres exclusion constraint (`bookings_no_overlap`, `extensions.btree_gist`), not just logged as a follow-up — applied live and baked into `db/tenant-schema.sql`. App-level `hasBufferConflict()` re-check still needed since the DB constraint isn't buffer-aware. |
| Double opt-in delivery | Stubbed (log confirm link server-side + dev-only `_dev_confirm_url` response field, `notification_log` marked honestly as `pending`/`failed`) rather than wiring a real email/SMS vendor now — no provider is chosen yet and picking one shouldn't block proving the booking logic itself. Swapping in a real provider later only touches `src/lib/notifications.ts`. |
| Rate limiting / bot protection (interim) | In-memory rate limiter + env-gated Turnstile stub (disabled by default, fails closed if enabled without a secret key) — real requirements from PROJECT_CONTEXT.md, built structurally correct now rather than skipped, but explicitly insufficient once actually deployed (no shared memory across serverless instances; no Cloudflare site key exists yet). |
| Cancel/reschedule token model | Capability tokens, not single-use — valid until `booking.starts_at` passes or `status` becomes finalized, not gated by `used_at`. Simpler than reissuing tokens per action and correctly allows repeat reschedules. Issued at confirm time (not creation), refreshed (not reissued) on reschedule. No Turnstile on these endpoints (acting requires an unguessable 32-byte token already, so bot enumeration isn't the threat model) but `rateLimitMiddleware` still applies as cheap defense-in-depth. No `audit_log` write for patient-initiated cancel/reschedule — that table is scoped to staff manual overrides. |
| Admin/staff data-access pattern | Admin routes use a per-request Supabase client scoped to the staff member's own JWT (anon key + Authorization forwarding), relying on existing RLS (`is_active_member()`) as the real authorization boundary — not the service-role key. `staffAuthMiddleware`'s one service-role read (`business_members` status) exists only to turn "RLS returns zero rows" into a clean 401/403. |
| Back-office UI stack | Astro (`output: "server"`) + React islands (`client:load`) + Tailwind v4 via `@tailwindcss/vite`, `apps/admin`. SSR auth via `@supabase/ssr` — Astro middleware checks the session on every request and redirects to `/login`, rather than a client-side-only check. Distinct neutral admin visual theme (Tailwind defaults), not the public-site's sage/cream/Georgia-serif brand — reserved for the future public marketing site. |

## Open / Non-Blocking Items

- Content accuracy of demo pricing/staff/hours — needs client review.
- Real photography sourcing (current images hotlinked from WordPress).
- SEO redirect map from old WordPress URLs.
- GDPR specifics beyond region: consent-checkbox copy, retention/purge
  policy for cancelled/old bookings.
- SMS provider choice.
- Backend hosting choice (Workers vs. Vercel).
- Rate limiting on the anon-key public catalog read path (Supabase
  project-level API limits or Cloudflare) — needed before launch to bound
  volume/scraping on the now-public services/staff/hours endpoints. Not
  an authorization gap (RLS/GRANTs are correctly scoped), purely a
  volume-control item.
- Email/SMS provider choice for real double opt-in delivery (currently
  stubbed — see Decisions Log) — needed before any real patient can
  actually receive a confirmation link.
- Cloudflare Turnstile site key — bot protection on booking creation is
  wired but disabled (`TURNSTILE_ENABLED=false`) until one exists.
- Real rate-limiting infra (Cloudflare rate rules or Upstash Redis) once
  hosting is decided — the current in-memory limiter doesn't hold up
  across serverless instances.
- End-to-end curl verification of the actual booking-creation DB path
  (`GET /availability` → `POST /bookings` → `POST /bookings/confirm`)
  needs to run locally with the real `DENTDI_SUPABASE_SECRET_KEY` —
  blocked in this sandbox by the same network egress restriction
  documented against `/_smoke`.
- End-to-end curl verification of the cancel/reschedule flow needs to run
  locally with the real `DENTDI_SUPABASE_SECRET_KEY` — same sandbox
  network restriction as the rest of the booking flow.
- Admin-side booking management is now **built** (see "Staff/admin
  backend built" above: `GET /admin/me`; bookings list/force-book/
  cancel/reschedule; patients list/detail/edit; service_categories,
  services, staff CRUD + staff_services linking; business_hours;
  closures) plus the `apps/admin` UI consuming it (bookings screen —
  list/filter/force-book/cancel/reschedule). **Owner account bootstrap
  is done and confirmed live** (2026-08-23 — `owner@dentdi.lv`,
  `business_members.status = active`, role `owner`, verified via a
  direct SQL read). **Still outstanding, needs a human running it
  locally with the real owner password:**
  1. The full 2xx-path curl sequence for every `/admin/*` route
     (documented per-task in
     `docs/superpowers/plans/2026-08-22-staff-admin-backend.md`, Task
     17's verification table), confirming each writes the expected
     `audit_log` row where applicable.
  2. The full browser flow through `apps/admin` (log in → bookings
     render with live seeded data → filter → force-book → cancel →
     reschedule → log out), per
     `docs/superpowers/plans/2026-08-22-back-office-admin-ui.md` Task
     14.

## Working Agreement

- Solo developer building this end to end — pragmatic over theoretically
  ideal.
- **Flag open decisions rather than deciding silently.**
- Push back with concrete tradeoffs when a request risks technical debt.
- Debt-avoidance lens: get irreversible/foundational things right the first
  time (schema shape, i18n structure, security primitives, RLS) — they're
  expensive to retrofit onto live booking data. Keep genuinely deferrable
  things (calendar sync, invoicing-as-a-feature) minimal or schema-only,
  but leave hooks so they're additive later.
