# Dent Di Booking Platform — Project Memory

This file is living memory for Claude Code sessions in this repo. Update it
as decisions are made or build stage changes — don't let it go stale.
Background/rationale that doesn't change often lives in `PROJECT_CONTEXT.md`;
the business/product concept (pricing, commercial terms, feature scope,
operating model) lives in `PRODUCT.md`; canonical domain vocabulary lives in
`GLOSSARY.md`; architecturally-shaped decisions get an ADR in `docs/adr/`.
This file tracks current state and active decisions.

## Role & Product

Solo developer's technical co-builder on a multi-tenant SaaS platform for
small service businesses (dental/medical practices, groomers, hairdressers,
salons) — a marketing website + booking system configured per business
through data, not forked code. Favor pragmatic, maintainable decisions over
theoretically "perfect" ones. First client: **Dent Di** (dentdi.lv), a
Latvian dental clinic with 2 staff (1 dentist, 1 nurse). Sold and onboarded
agency-managed, not self-serve — see `PRODUCT.md` for the full product/
business concept (ADR-0001).

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
      - 60/60 vitest passing. **Not yet verified live** (DB-touching
        paths) — no environment-specific blocker, just not yet run; run
        locally with the real `DENTDI_SUPABASE_SECRET_KEY`.
- [x] `POST /bookings/cancel` / `POST /bookings/reschedule`.
      Capability-token model (not single-use — validity from
      `expires_at`/booking `status`, not `used_at`), issued at confirm
      time, refreshed (not reissued) on reschedule. Reschedule reuses
      `hasExistingConflict` with an `excludeBookingId` param. 60/60
      vitest passing, not yet verified live (same as above).
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
      - 102/102 vitest passing. **Verified live** (2026-08-23):
        `GET /admin/me`, `/admin/bookings`, `/admin/services`,
        `/admin/staff` all `200` via curl with a real session token;
        bookings force-book/reschedule/cancel additionally verified
        end-to-end via the real browser (see the Playwright entry
        below). **Owner account note:** the account bootstrapped
        earlier the same day had been deleted and recreated with a new
        `auth.users.id` (`...27fa`) by the time login was attempted —
        its `business_members` row was never recreated to match, so
        Supabase Auth accepted the login (200) while
        `staffAuthMiddleware` correctly 403'd on the orphaned
        membership (exactly the "clean 401/403" behavior it's designed
        for). Fixed by re-inserting the `business_members` row
        (`active`, role `owner`) against the current id.
        `staffAuthMiddleware` now `console.warn`s on every such denial
        (userId + path) so a real recurrence is traceable server-side.
        **Update (2026-08-24):** patients, catalog CRUD, business-hours,
        and closures routes now each have a corresponding UI screen and
        an E2E spec exercising them (see the admin UI resource parity
        entry below) — this replaces the standalone curl-sweep item.
        (The `audit_log`-writes claim above was, and remains, scoped to
        bookings only — see the known gap noted under "Open /
        Non-Blocking Items".)
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
      13/13 vitest passing, `tsc --noEmit`/`astro check` clean.
      **Full browser flow now confirmed** (2026-08-23, via the
      Playwright spec below): log in → bookings render with live
      seeded data → filter → force-book → reschedule → cancel → log
      out → redirect guard holds. One transient `403` was hit on the
      very first cold login attempt (root cause below) and hasn't
      recurred across 8+ direct requests and 2 full browser runs since
      — treated as resolved, not as proven-non-recurring. Deferred, not
      dropped: a calendar view (list
      view only this pass), Patients/Catalog CRUD UI, and Paytraq
      receipt UI — each its own follow-up plan reusing this
      foundation.
- [x] **Playwright E2E added to `apps/admin`** (`@playwright/test`,
      `playwright.config.ts`, `e2e/`). Deliberately doesn't manage
      servers itself — assumes `apps/api` + `apps/admin` are already
      running locally against the real Dent Di project, since these
      specs exercise live data rather than mocks or a throwaway
      instance. First spec (`e2e/login-and-bookings.spec.ts`) covers
      exactly the Task 14 manual-verification checklist: login →
      bookings render → filter → force-book → reschedule → cancel →
      log out → redirect guard. Credentials come from
      `E2E_OWNER_EMAIL`/`E2E_OWNER_PASSWORD` env vars, never hardcoded;
      the spec `test.skip`s (not fails) when they're unset, so a bare
      `pnpm exec playwright test` doesn't hang in an unconfigured
      environment. Run: `E2E_OWNER_EMAIL=... E2E_OWNER_PASSWORD=...
      pnpm --filter @booking-system/admin test:e2e`. **Verified**: full
      spec passing against the live project, repeatably. `chromium` only
      for now (no cross-browser matrix — one browser is enough signal
      at this stage; revisit if/when Safari-specific bugs actually
      surface). No CI wiring yet — local-only until hosting is decided.
      Test dates are derived from the run timestamp (year 2031, day
      varies) rather than fixed — fixed dates left ambiguous leftover
      rows across repeated manual runs against live data, causing
      unrelated strict-mode-violation failures in later runs.
- [x] **Two real bugs found and fixed via this E2E work** (2026-08-23):
      1. `staffAuthMiddleware` occasionally 403s a valid, active
         session under concurrent requests — reproduced directly
         (~1-2% of paired requests matching `bookings.astro`'s
         `Promise.all([listServices, listStaff])` pattern; 0/180 in a
         wider run, consistent with rare transient flakiness validating
         a token against Supabase Auth under concurrent load, not a
         real authorization gap). Since the middleware runs before any
         route logic, a 403 here can never mean a write partially
         happened, so `apiFetch` (`apps/admin/src/lib/api/client.ts`)
         now retries once on 403 before surfacing the error. Covered by
         `apps/admin/test/lib/api/client.test.ts`. `staffAuthMiddleware`
         also now `console.warn`s every denial (userId + path) for
         server-side traceability.
      2. `apps/admin`'s dev server defaulted to Astro's `:4321` unless
         launched with an explicit `--port 8080`, while `apps/api`'s
         `ADMIN_APP_ORIGIN` (CORS) expects `:8080` — a plain
         `pnpm run dev` silently broke every **browser-side** `/admin/*`
         call (force-book/cancel/reschedule) while SSR-side calls (the
         initial page load) kept working fine, since CORS is
         browser-only — a confusing split when debugging from symptoms
         alone. Fixed by locking the port in `apps/admin/astro.config.mjs`
         so a bare `pnpm run dev` always lands on `:8080`.
- [x] **Full admin UI resource parity + negative-path/error-state E2E
      coverage** (2026-08-24). Every `/admin/*` resource with a working
      API route now has a corresponding UI screen: Patients (list/
      search/detail/edit), Catalog (service categories/services/staff
      CRUD + staff↔service linking, tabbed screen), Scheduling
      (business hours/closures, tabbed screen) — plus negative-path
      coverage added to the existing Bookings screen (conflicting
      force-book, missing-contact-info form guard). Built via a strict
      TDD split per screen: a Playwright spec written and confirmed red
      first, then a separate agent with no visibility into the spec
      file built the UI against a written accessibility contract
      (labels/roles/placeholders), then the original spec confirmed
      green. 8 E2E spec files total now exist in `apps/admin/e2e/`
      (`login-and-bookings`, `bookings-errors`, `patients`,
      `catalog-categories`, `catalog-services`, `catalog-staff`,
      `scheduling-hours`, `scheduling-closures`), all written against
      the live Dent Di project. This plan added no new unit tests (all
      new coverage is E2E, per plan) — 17/17 admin vitest and 104/104
      api vitest passing, both pre-existing counts confirmed unbroken
      by a fresh regression run, `astro check`/`tsc --noEmit` clean.
      **Update (2026-08-25): browser-verified.** All 8 specs run
      repeatably green (10/10 tests, run twice back to back, both
      serially and with default parallelism) against real dev servers
      and the live Dent Di project. Getting there surfaced 3 real
      backend bugs and 5 spec-only bugs that static review hadn't
      caught (all fixed, see the Decisions Log row below):
      - **CORS didn't allow `PUT`** (`apps/api/src/app.ts`) — silently
        blocked business-hours replace and staff↔service link replace
        from ever completing in a real browser (vitest never caught
        this; it calls the Hono app in-process, bypassing actual
        browser CORS enforcement).
      - **False 404 on translation-only PATCHes**
        (`admin-service-categories.ts`, and defensively
        `admin-services.ts`/`admin-staff.ts`): building the Supabase
        `.update()` payload only from direct-column fields meant a
        request touching only a translations-table field (name/bio)
        sent an empty update, which Supabase reports as zero rows
        matched — wrongly 404ing a row that genuinely exists. Only the
        Categories panel's edit flow happened to send name-only, which
        is why only that spec surfaced it.
      - 5 Playwright locator/timing bugs across the specs (stale
        `row` locators after an inline-edit re-render, date-label
        collisions between leftover rows and `Date.now() % 27` not
        actually being collision-free across nearby runs, a strict-mode
        collision with the astro dev toolbar's hidden props dump, and a
        weak save-button-enabled settle signal) — the UI itself was
        correct in every case.
      A handful of Minor code-review findings remain deferred (not
      dropped) across these screens — payload-shape polish, a couple of
      missing `required` attributes on inline-edit fields, one
      data-loading-pattern inconsistency in `ClosuresPanel`, one missing
      button-disabled state — non-blocking, tracked in review history.

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
| Dev/testing approach | Faker seed script; purge before real release. `apps/api` unit tests via vitest; `apps/admin` unit tests via vitest + browser E2E via Playwright (`apps/admin/e2e/`), run locally against the real dev servers + live Supabase project — no mocked backend for E2E, since the point is proving the real integration works |
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
| Back-office UI stack | Astro (`output: "server"`) + React islands (`client:load`) + Tailwind v4 via `@tailwindcss/vite`, `apps/admin`. SSR auth via `@supabase/ssr` — Astro middleware checks the session on every request and redirects to `/login`, rather than a client-side-only check. Distinct neutral admin visual theme, not the public-site's sage/cream/Georgia-serif brand — reserved for the future public marketing site. |
| Admin UI resource coverage | Every `/admin/*` resource with a working API route now has a corresponding UI screen: Patients (list/search/detail/edit), Catalog (service categories/services/staff CRUD + staff↔service linking), Scheduling (business hours/closures), Dashboard (weekly availability calendar + confirmed/pending/cancelled stats, the new post-login landing page) — built via a strict TDD split (Playwright spec written and confirmed red first, then a fresh agent with no visibility into the spec built the UI against a written accessibility contract, then the spec confirmed green). 9 E2E spec files total, all against the live Dent Di project. |
| UI component library | **shadcn/ui, for every new UI element in any Astro app in this repo, going forward** (`apps/admin` now, `apps/site` when it exists) — not just the Dashboard's original scope (`Button`/`Card`/`Popover`/`Calendar`). New buttons, dialogs, dropdowns, form controls, etc. should be added via the shadcn CLI (`pnpm dlx shadcn@latest add <component>`) rather than hand-rolled Tailwind markup, matching the existing `components.json`/`@/components`/`@/lib/utils` setup already wired into `apps/admin`. This does not mean retrofitting every existing hand-rolled element (native `<select>`s, plain `<button>`s across Bookings/Patients/Catalog/Scheduling) on sight — those stay as-is unless a screen is being touched for another reason anyway; the directive is forward-looking; the CLI init step itself (Task 1 of the Dashboard plan) already changed the app-wide theme/fonts for all existing screens as a side effect, which was flagged but not undone. |
| Admin E2E suite — browser-verified | All 8 specs (10 tests) run repeatably green against real dev servers + the live Dent Di project, on a machine with normal network access — the earlier "sandbox has no network egress" caveat was specific to one prior execution environment, not a lasting constraint, and has been removed from this file. Getting a clean run surfaced and fixed 3 real backend bugs (CORS missing `PUT`; a false-404-on-translation-only-PATCH bug in `admin-service-categories.ts`/`admin-services.ts`/`admin-staff.ts`) and 5 Playwright-only bugs (stale row locators post-edit-render, `Date.now() % 27` date-label collisions with leftover rows, a strict-mode collision with the astro dev toolbar's hidden props dump, a weak save-button settle signal) — none were real UI defects. |
| Operating model (productization) | **Agency-managed, not self-serve** (ADR-0001) — every Tenant is sold and onboarded by hand, indefinitely; no signup/trial flow or automated tenant provisioning is planned. Full concept in `PRODUCT.md`. |
| Target customer (ICP) | Confirmed broad, not narrowed: staff-based appointment businesses generally (dental/medical, grooming, salons, hairdressers), not medical-only. |
| Domain terminology | **Tenant** is the canonical term for a subscribing business (schema keeps `business_profile`/"Business" as the same concept, unrenamed). **Customer** is the canonical term for the Tenant's own end customer, replacing dental-specific "Patient" as domain language, with a per-Tenant-configurable *display label* so staff still see vertical-appropriate wording (ADR-0002; schema rename **pending implementation**). Platform's own product name not yet chosen. See `GLOSSARY.md`. |
| CRM/CMS feature scope (productization) | CRM stays lightweight for v1 (profile + booking history + staff notes; no pipelines/campaigns/segmentation). CMS stays developer-configured at onboarding (no client-facing content/theme editor). Both can expand later on real demand, but new features must stay config-driven/generic in shape even when a specific Tenant (Dent Di) drives the request first — not dentistry-hardcoded. |
| Platform branding | Public booking widget/site carries a light "powered by [Platform]" credit; staff-facing admin backend stays neutral/unbranded. |
| Pricing & billing | One-time Setup fee + recurring Monthly fee (hosting/infra + maintenance + minor config tweaks bundled; net-new features billed separately), both invoiced through Stripe operationally (dashboard-driven) — no Stripe webhook integration built into `apps/api`. No tiered packages yet. |
| Admin/site deployment model | `apps/admin` stays one deployment per Tenant (today's build-time `TENANT_SLUG` model, unchanged); the future `apps/site` follows the same per-Tenant-deployment pattern, each on the Tenant's own custom domain. `apps/api` remains the one shared, dynamically-tenant-resolved deployment. See ADR-0003. |
| Support & SLA | One dedicated support email, best-effort response — no formal uptime SLA or penalty clause at this stage. |
| Data retention (productization) | Customer/booking records retained indefinitely while a Tenant is active; purged within ~90 days of contract end (after the offboarding grace period's data-export offer). Cancelled bookings aren't separately time-purged. Becomes the default clause in the Tenant contract/DPA. |
| Tenant contract / DPA | A standard, reusable contract/DPA template, signed identically by every Tenant — not improvised per client. States the termination/grace-period and data-retention terms above; Tenant is Data Controller, Platform is Data Processor. |
| Internal tenant tracking | Stays a spreadsheet (Tenant name, Supabase project ref, contract/billing status) rather than an in-app back-office tool, until tenant count makes manual tracking unwieldy. |
| Geographic scope (productization) | Implicitly Latvia/Baltics-focused (EUR, Latvian-aware contract language) for now; expand opportunistically rather than building region-agnostic billing/legal infrastructure speculatively. |

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
  still needs to run with the real `DENTDI_SUPABASE_SECRET_KEY` — no
  environment blocker, just not yet done.
- End-to-end curl verification of the cancel/reschedule flow still needs
  to run the same way — not yet done.
- Admin-side booking management is now **built and browser-verified**
  (see "Staff/admin backend built" and "apps/admin foundation" above).
  **Owner account status** (2026-08-23): the account was deleted and
  recreated at some point after the original bootstrap (new
  `auth.users.id`, ending `...27fa`, `created_at` 2026-08-23 10:40
  UTC) — its `business_members` row went with it and was never
  recreated, which is what caused a `403` on login (Supabase Auth
  accepted the password fine; the app-layer membership check correctly
  rejected the orphaned session). Fixed by re-inserting
  `business_members` (`active`, role `owner`) against the current id.
  The full login → bookings → force-book → reschedule → cancel →
  log out flow is now confirmed via an automated Playwright spec
  (`apps/admin/e2e/login-and-bookings.spec.ts`), not just curl.
  **Update (2026-08-24):** the remaining `/admin/*` routes — patients,
  catalog CRUD (`service_categories`/`services`/`staff`), staff↔service
  linking, business-hours, closures — are now exercised end-to-end via
  dedicated Playwright specs (`apps/admin/e2e/patients.spec.ts`,
  `catalog-categories.spec.ts`, `catalog-services.spec.ts`,
  `catalog-staff.spec.ts`, `scheduling-hours.spec.ts`,
  `scheduling-closures.spec.ts`) rather than a standalone curl sweep —
  that curl-sequence item is resolved, superseded by the E2E coverage.
  **Known gap, not resolved by this UI work:** per the route inventory,
  only booking mutations (`force_book`/`staff_cancel`/
  `staff_reschedule`) write an `audit_log` row —
  `service_categories`/`services`/`staff`/`staff_services`/
  `business_hours`/`closures` mutations write none. Flag this if audit
  coverage of catalog/scheduling edits is ever required; it's a
  backend change, out of scope for UI work.
- **Productization follow-ups from the `PRODUCT.md` concept pass**
  (2026-10-21), none blocking Dent Di's current build:
  - `patients` → `customers` schema/code rename + per-Tenant
    display-label mechanism (ADR-0002) — decided, not yet implemented.
    Touches the schema, generated types, `admin-patients.ts` and
    similar routes, the admin UI's Patients screen, and
    `patients.spec.ts`.
  - Platform product name — not yet chosen.
  - Onboarding runbook (Supabase project → schema → seed/theme/content →
    DNS → staff accounts → go-live) — not yet written.
  - Tenant contract/DPA template — not yet drafted.
  - Exact grace-period length for the offboarding term — illustrative
    ~14 days in `PRODUCT.md`, not finalized.

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

## Agent skills

### Issue tracker

Issues live as GitHub Issues (`mrkgnt/booking-system`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` + `docs/adr/` at the repo root, created lazily as terms/decisions are resolved). See `docs/agents/domain.md`.
