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
- [x] **DB-level schema test suite: `db/tests/schema_tests.sql`, 16/16
      passing.** Covers: business_profile singleton PK, roles.key
      uniqueness, bookings.idempotency_key uniqueness, bookings.status
      check constraint, translations composite uniqueness, staff_services
      composite PK dedup, patients→bookings cascade delete, staff delete
      correctly RESTRICTed when referenced by a booking (bookings.staff_id
      has no ON DELETE clause), staff→staff_services/business_hours
      cascade delete, and 6 access-control tests via `SET ROLE`
      (anon blocked from patients/bookings, anon can read the public
      catalog but only `is_active=true` rows and read-only, authenticated
      non-members blocked by RLS, anon can't call `is_active_member()`).
      Every destructive test runs inside a nested begin/exception block
      forced to roll back via a sentinel exception (PL/pgSQL has no
      SAVEPOINT statement) — verified against live row counts before/after,
      no residue left. Run manually via Supabase MCP `execute_sql`; not
      yet wired into an automated `vitest`+`supabase-js` CI suite since
      that needs real env-based credentials that don't exist until the
      Hono API project is scaffolded — noted as a follow-up in the test
      file itself.
      **Catalog-read-access decision: resolved.** The public booking
      widget reads the catalog (`services`, `service_categories`, `staff`,
      `business_hours`, `translations` scoped to public content types)
      directly via Supabase REST using the anon/publishable key, rather
      than proxying through Hono — nothing in these tables is sensitive
      (service names/prices, staff names, hours), so routing it through
      an extra API hop added latency/build cost for no real security gain.
      Rejected alternative: embedding a client-side "identification
      token" in the widget — anything shipped in browser JS is
      extractable, so a static token can't function as a secret; the
      actual boundary is the scoped GRANT + RLS policy, not key secrecy.
      Implemented as `public_catalog_read_access` migration: `GRANT
      SELECT` to `anon` on the 5 catalog tables only (everything else —
      patients/bookings/business_members/etc. — still has zero grant to
      anon), plus `for select to anon using (is_active = true)` policies
      (business_hours has no is_active concept, exposed unconditionally;
      translations scoped to an explicit allowlist of public entity_types
      so a future sensitive entity_type isn't accidentally made public by
      default). Booking creation and availability computation remain
      entirely behind Hono + the service role key, unaffected — writes
      are the real abuse surface, not catalog reads. Follow-up: rate
      limiting on the anon-key read path (Supabase project-level API
      limits or Cloudflare) is still needed before launch to bound
      volume/scraping — noted as a pre-launch item, not an authorization
      concern.
      **Second, unrelated bug found and fixed while verifying the above:**
      `authenticated` had literally zero table-level GRANTs on any table
      (only the Postgres-default REFERENCES/TRIGGER/TRUNCATE) — the
      `members access X` RLS policies were written assuming grants
      existed, but they were never issued in the original schema. This
      meant a real logged-in staff member would have gotten "permission
      denied" on every table, independent of RLS/membership status —
      the entire admin/staff backend would have been broken from day one.
      Fixed via `grant_authenticated_member_access` migration (full CRUD
      grant to `authenticated` on all 18 tables, matching what the
      existing policies already assumed) plus
      `scope_member_policies_to_authenticated` (the original policies had
      no `to authenticated` clause, so Postgres evaluated them — and thus
      `is_active_member()` — for `anon` too, which broke once anon's
      EXECUTE on that function was revoked as an earlier hardening step).
      `db/tenant-schema.sql` updated to include both fixes plus the
      catalog-read policies, so future client projects get this correct
      from the start rather than needing the same live patching.
- [x] **Hono API catalog-read-access decision made** (see above) — no
      longer blocking Hono scaffolding.
- [ ] **Next:** scaffold the Hono API project — tenant-aware from day one.
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
| Public catalog reads | Direct via Supabase REST with anon key (scoped GRANT+RLS on services/service_categories/staff/business_hours/translations only), not proxied through Hono — nothing in the catalog is sensitive, so the extra hop bought no security. No client-side "identification token" — anything shipped in browser JS is public and can't function as a secret. |

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
