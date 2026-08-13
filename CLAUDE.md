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

- [x] Multi-tenant vs. per-tenant architecture decided
- [x] `db/tenant-schema.sql` designed and finalized
- [x] Repo scaffolding: `.gitignore`, `CLAUDE.md`, `PROJECT_CONTEXT.md`
- [x] **Dent Di's real Supabase project provisioned and schema applied**
      (via Supabase MCP, not the CLI sequence originally planned — see
      note below). Project ref `eafeskigfcinnwahjiyx`, region `eu-west-1`
      (Ireland, EU — satisfies GDPR residency), Postgres 17. Dashboard
      still shows the project name as "Dent Di back office" — cosmetic
      only, rename via Project Settings → General whenever convenient.
      `business_profile` seeded: slug `dentdi`, default_locale `lv`,
      supported_locales `{lv,ru,en}`, timezone `Europe/Riga`, currency
      `EUR`, status `onboarding`. `roles` seeded with `owner`/`staff`.
      All 18 tables created with RLS enabled; `set_updated_at` and
      `is_active_member` hardened with explicit `search_path`; anon RPC
      access to `is_active_member()` revoked (authenticated access kept —
      required for RLS policy evaluation).
      Project pre-existed with 3 unrelated prototype tables
      (`working_hours`, `blackout_dates`, `appointment_requests`, no real
      data) — dropped before applying the real schema, per explicit
      instruction.
- [x] **Faker-based TypeScript seed script built and run against the live
      project.** `db/seed/generate-seed.ts` (deterministic, `faker.seed(42)`)
      generates `db/seed.sql`: 6 service categories, 34 services (LV/RU/EN
      name translations), 2 staff (dentist + hygienist, synthetic names —
      no real Dent Di staff names used), 46 staff↔service links, 7
      business_hours rows (Mon–Fri 9–18, weekends closed), 18 patients
      across all 3 locales, 28 bookings spanning past/future dates and all
      status values, 12 notification_log rows. Applied to the live project
      via Supabase MCP `execute_sql` (chunked into sections — no
      DATABASE_URL/service-role key available in this environment to run
      the script directly against Supabase, only anon/publishable keys are
      exposed via MCP by design). `npm run seed:generate` regenerates
      `db/seed.sql` from scratch; `db/seed/purge.sql` clears all seed/dev
      data before real client data enters the project (per the GDPR/dev
      decision in the table above).
- [x] **DB-level schema test suite: `db/tests/schema_tests.sql`, 13/13
      passing.** Covers: business_profile singleton PK, roles.key
      uniqueness, bookings.idempotency_key uniqueness, bookings.status
      check constraint, translations composite uniqueness, staff_services
      composite PK dedup, patients→bookings cascade delete, staff delete
      correctly RESTRICTed when referenced by a booking (bookings.staff_id
      has no ON DELETE clause), staff→staff_services/business_hours
      cascade delete, and 4 access-control tests via `SET ROLE`
      (anon/authenticated blocked from patients/bookings/services).
      Every destructive test runs inside a nested begin/exception block
      forced to roll back via a sentinel exception (PL/pgSQL has no
      SAVEPOINT statement) — verified against live row counts before/after,
      no residue left. Run manually via Supabase MCP `execute_sql`; not
      yet wired into an automated `vitest`+`supabase-js` CI suite since
      that needs real env-based credentials that don't exist until the
      Hono API project is scaffolded — noted as a follow-up in the test
      file itself.
      **Finding surfaced by the access-control tests (open decision, not
      fixed):** `anon`/`authenticated` currently have no table-level GRANT
      at all on this project (blocked before RLS is even evaluated), and
      even the RLS policies as written would restrict ALL tables —
      including `services`/`staff`/`service_categories`/`business_hours`
      — to authenticated business members only. That means the public
      booking widget cannot browse the catalog via direct Supabase REST
      calls today; either (a) the Hono API must proxy catalog reads too,
      not just booking writes, or (b) a deliberate public-read
      GRANT+policy pair should be added for catalog tables to cut Hono
      out of the read path. Not decided yet — flag before building the
      Hono API's service-listing endpoints.
- [ ] **Next:** scaffold the Hono API project — tenant-aware from day one.
      Decide the catalog-read-access question above before/while building
      the services/staff listing endpoints.
- [ ] Implement and curl/Postman-test booking creation (server-side
      availability calc + idempotency + double opt-in). No UI until solid.
- [ ] Generate TypeScript types from the live schema for the Hono API
      (`supabase gen types typescript` or MCP equivalent) — not done yet.
- [ ] Wire up automated DB tests (vitest + supabase-js) once the Hono API
      project exists with real env-based Supabase credentials — today's
      `db/tests/schema_tests.sql` is the manually-run equivalent.

Note: schema was applied directly via the Supabase MCP server
(`apply_migration`) against the live project, not through the originally
planned local CLI flow (`supabase init` → local Docker stack → `db push`).
No local `supabase/migrations` directory exists yet in this repo — if we
want migration history tracked in-repo going forward (recommended before
client #2), that's still open.

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

## Open / Non-Blocking Items

- Content accuracy of demo pricing/staff/hours — needs client review.
- Real photography sourcing (current images hotlinked from WordPress).
- SEO redirect map from old WordPress URLs.
- GDPR specifics beyond region: consent-checkbox copy, retention/purge
  policy for cancelled/old bookings.
- SMS provider choice.
- Backend hosting choice (Workers vs. Vercel).

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
