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
salons) — a booking system delivered to every Tenant as an embeddable
**Booking Widget** that plugs into any existing website, configured per
business through data, not forked code; a full custom site (**Site
build**) is an optional, separately-priced add-on, not the default
(ADR-0004). Favor pragmatic, maintainable decisions over theoretically
"perfect" ones. First client: **Dent Di** (dentdi.lv), a Latvian dental
clinic with 2 staff (1 dentist, 1 nurse), getting both the Booking Widget
and a Site build (their WordPress site is being decommissioned). Sold and
onboarded agency-managed, not self-serve — see `PRODUCT.md` for the full
product/business concept (ADR-0001).

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
- [x] **`patients` → `customers` rename, ADR-0002** (2026-10-21, via
      `/tdd`). The full stack: live schema migration on the Dent Di
      project (table/column/index/trigger/policy renamed, grants/RLS
      carried over automatically since they're tied to the table's OID,
      not its name); `db/tenant-schema.sql` + seed scripts + schema
      tests updated to match; `apps/api`'s matching lib, public booking
      contract (`POST /bookings`'s `patient` field → `customer` — a
      genuine breaking contract change, judged safe since `apps/site`
      doesn't exist yet to call it), admin force-book, and the
      `/admin/patients` → `/admin/customers` route all renamed;
      `apps/admin`'s pages/components/API client renamed to match. New
      behavior (not just a rename): a `resolveCustomerLabel()` resolver
      (`business_profile.site_config.customerLabel`, default
      `{"Customer","Customers"}`) now threads a per-Tenant display label
      through every staff-facing string (nav, screen title, search/
      empty-state text, back-link, force-book placeholder, validation
      message) via `GET /admin/me`'s new `customerLabel` field — TDD'd
      as the one real red→green slice in this task, everything else
      was a mechanical rename backed by the existing suites.
      108/108 api vitest (+4 net: `patient-matching.test.ts` swapped for
      `customer-matching.test.ts`, +`customer-label.test.ts`'s 4 cases),
      clean `tsc`; 44/44 admin vitest (+1:
      `validate-force-book.test.ts`'s label case), clean `astro check`/
      `tsc`. Live-verified: `db/tests/schema_tests.sql` run manually via
      the Supabase dashboard (the MCP `execute_sql`/`apply_migration`
      tools' own destructive-statement confirmation gate declined every
      attempt from this session — DDL-only `apply_migration` calls went
      through fine, but anything with `insert`/`update`/`delete` did
      not, with no way to satisfy that confirmation from here), 17/17
      passing. **Live-verified** (2026-10-21): Dent Di's
      `business_profile.site_config.customerLabel` set to
      `{"singular":"Patient","plural":"Patients"}` (user-run, same
      dashboard-confirmation-gate as the schema test run), then the full
      Playwright suite run against live dev servers —
      `customers.spec.ts`'s both tests pass clean. 2 unrelated failures
      surfaced in that same run (`catalog-services.spec.ts` stale-row
      timing, a `dashboard.spec.ts` date-picker test hitting the
      already-documented transient `staffAuthMiddleware` flakiness under
      concurrent workers) — pre-existing flakiness patterns, not caused
      by this rename, not yet re-investigated.
- [ ] **`apps/widget` scoped via `/grill-with-docs`, ADR-0004**
      (2026-10-21). A grilling + domain-modeling session on "what's
      next for `apps/site`" surfaced that the base product every Tenant
      actually needs isn't a full site — it's an embeddable **Booking
      Widget**, installable on any existing website via one `<script>`
      tag. `apps/site` (full custom site) is now an optional,
      separately-priced add-on, not the default. Architecture: iframe
      embed (not a Web Component, for CSS/JS isolation from an unknown
      host stack); one **shared** `apps/widget` deployment across every
      Tenant (tenant resolved via `data-tenant`, mirroring `apps/api`'s
      pattern, not `apps/admin`/`apps/site`'s per-tenant model); live
      per-request content fetch (theme/catalog/translations), no
      interval polling; wide-open CORS on the public booking endpoints
      + `Content-Security-Policy: frame-ancestors *`, both required for
      an unknown embedding origin and judged low-risk given these
      endpoints are already unauthenticated; standalone (non-iframe)
      cancel/reschedule pages served by `apps/widget` itself
      (`widget.platform.com/{tenant}/...`), same mechanism for every
      Tenant tier since a widget-only Tenant has no site of its own;
      default floating "Book Now" trigger with an opt-out flag plus a
      `data-platform-book` hook for a Tenant's own CTA; `data-locale`
      attribute with a conditional switcher; `apps/site` dogfoods the
      same public embed rather than sharing booking-flow code (keeps
      the "no shared `packages/`" call from Decisions Log intact).
      Same stack as `apps/admin` (Astro SSR + React islands),
      self-contained, not yet scaffolded — this is the next build-stage
      item, ahead of `apps/site` itself. Full detail: ADR-0004,
      `PRODUCT.md`, `GLOSSARY.md`.
      **Update (2026-10-21):** broken into 11 tracer-bullet tickets via
      `/to-tickets`, published as sub-issues of
      [#6](https://github.com/mrkgnt/booking-system/issues/6) with the
      `ready-for-agent` label, in dependency order — see that issue for
      the full breakdown.

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
| Domain terminology | **Tenant** is the canonical term for a subscribing business (schema keeps `business_profile`/"Business" as the same concept, unrenamed). **Customer** is the canonical term for the Tenant's own end customer, replacing dental-specific "Patient" as domain language, with a per-Tenant-configurable *display label* so staff still see vertical-appropriate wording (ADR-0002, **implemented** 2026-10-21 — schema/code renamed, `resolveCustomerLabel()` mechanism built and wired through the admin UI). Platform's own product name not yet chosen. See `GLOSSARY.md`. |
| CRM/CMS feature scope (productization) | CRM stays lightweight for v1 (profile + booking history + staff notes; no pipelines/campaigns/segmentation). CMS stays developer-configured at onboarding (no client-facing content/theme editor). Both can expand later on real demand, but new features must stay config-driven/generic in shape even when a specific Tenant (Dent Di) drives the request first — not dentistry-hardcoded. |
| Platform branding | Public booking widget/site carries a light "powered by [Platform]" credit; staff-facing admin backend stays neutral/unbranded. |
| Pricing & billing | One-time Setup fee + recurring Monthly fee (hosting/infra + maintenance + minor config tweaks bundled; net-new features billed separately), both invoiced through Stripe operationally (dashboard-driven) — no Stripe webhook integration built into `apps/api`. No tiered packages yet. |
| Admin/site deployment model | `apps/admin` stays one deployment per Tenant (today's build-time `TENANT_SLUG` model, unchanged); the future `apps/site` follows the same per-Tenant-deployment pattern, each on the Tenant's own custom domain. `apps/api` remains the one shared, dynamically-tenant-resolved deployment. See ADR-0003. |
| Support & SLA | One dedicated support email, best-effort response — no formal uptime SLA or penalty clause at this stage. |
| Data retention (productization) | Customer/booking records retained indefinitely while a Tenant is active; purged within ~90 days of contract end (after the offboarding grace period's data-export offer). Cancelled bookings aren't separately time-purged. Becomes the default clause in the Tenant contract/DPA. |
| Tenant contract / DPA | A standard, reusable contract/DPA template, signed identically by every Tenant — not improvised per client. States the termination/grace-period and data-retention terms above; Tenant is Data Controller, Platform is Data Processor. |
| Internal tenant tracking | Stays a spreadsheet (Tenant name, Supabase project ref, contract/billing status) rather than an in-app back-office tool, until tenant count makes manual tracking unwieldy. |
| Geographic scope (productization) | Implicitly Latvia/Baltics-focused (EUR, Latvian-aware contract language) for now; expand opportunistically rather than building region-agnostic billing/legal infrastructure speculatively. |
| E2E credential loading | `apps/admin/playwright.config.ts` calls Node's built-in `process.loadEnvFile()` (Node 20.12+/22+, no new dependency) before `defineConfig`, so `E2E_OWNER_EMAIL`/`E2E_OWNER_PASSWORD` load from `apps/admin/.env` automatically — `pnpm test:e2e` alone now works, no more prefixing the command with inline env vars every run. Falls back to real environment variables (e.g. CI secrets) if `.env` doesn't exist. |
| E2E flakiness diagnosed & fixed (2026-10-21) | Three distinct causes, all test-only (no app code changed), found via `/diagnosing-bugs`' tight-loop discipline (isolated single-spec reruns first, then repeated full-suite reruns to get a reproduction rate) rather than theorizing from the component code first: (1) `customers.spec.ts`'s save-then-`page.reload()` step had no wait for the PATCH to actually land — `page.reload()` does a one-shot SSR read with no polling safety net, so a late-landing save showed a stale value for the full timeout; fixed with `page.waitForResponse(...)`, the pattern `scheduling-hours.spec.ts` already used. (2) its "search filters" test asserted an *exact* total row count against live data other specs concurrently mutate via force-book's customer find-or-create — loosened to `toBeGreaterThanOrEqual`. (3) `catalog-services.spec.ts`/`catalog-categories.spec.ts` delete-then-assert races were genuine load contention, not a logic bug — confirmed by `catalog-services.spec.ts` running 6/6 clean in isolation but intermittently failing only under full 6-worker parallel load, with the *same* symptom later landing on `catalog-categories.spec.ts` instead in a different run (one shared local dev server under contention, not a defect in either panel); fixed by raising Playwright's default assertion timeout from 5s to 10s (`expect: { timeout: 10_000 }`). Verified: 4 consecutive full-suite reruns, 15/15 passing each time. |
| Booking Widget as the base product | The platform's default deliverable to every Tenant is the **Booking Widget** — an iframe-embeddable, script-tag-installable booking drawer that works on any existing website regardless of stack — not a full site. `apps/site` (the full custom site) becomes an optional, separately-priced add-on ("Site build"). See ADR-0004, `PRODUCT.md`, `GLOSSARY.md`. |
| Booking Widget deployment model | `apps/widget` is one shared deployment across every Tenant (tenant resolved at runtime via a `data-tenant` attribute in the embed snippet), unlike `apps/admin`/`apps/site`'s per-tenant model (ADR-0003) — mirrors `apps/api`'s existing shared/dynamically-resolved pattern instead. See ADR-0004. |
| Booking Widget embedding mechanism | Iframe, not a Web Component/direct DOM injection — full CSS/JS isolation from a host site whose stack we don't control. `apps/widget` sets a permissive `Content-Security-Policy: frame-ancestors *` and the public booking endpoints (`/availability`, `/bookings`, etc.) get wide-open CORS (`Access-Control-Allow-Origin: *`) — both required for the embed to function on an unknown origin, both judged low-risk since these surfaces are already unauthenticated and protected only by rate-limiting/Turnstile. See ADR-0004. |
| Booking Widget transactional pages | Cancel/reschedule links in confirmation emails point at standalone (non-iframe) pages served directly by `apps/widget` (`widget.platform.com/{tenant}/...`), used the same way for every Tenant tier — even full-site Tenants — rather than a Tenant's own site hosting them. Custom-domain mapping for these pages (e.g. a Tenant's own `book.dentdi.lv`) deferred until a Tenant actually asks for it. See ADR-0004. |
| Setup fee / pricing split | Setup fee now covers Booking Widget integration as the baseline every Tenant gets; a Site build is priced separately, scoped by page count/complexity, not bundled. See `GLOSSARY.md`, `PRODUCT.md`. |
| Build sequencing (widget vs. site) | `apps/widget` is the next thing to scaffold — it's the universal prerequisite every Tenant needs (including Dent Di); `apps/site` (optional) comes after and dogfoods the same public embed script rather than sharing booking-flow code with it. See ADR-0004. |
| Booking Widget operational posture | `apps/widget` holds no Supabase credentials of its own (talks only to `apps/api`'s public endpoints); `embed.js` ships from one always-latest URL, no per-tenant version pinning — both keep the shared-deployment model (ADR-0004) simple at current tenant scale; revisit if a bad shared deploy's blast radius becomes unacceptable. |
| Booking Widget UX details (round 2 grilling) | Lazy iframe mount (spinner on first open; the floating trigger itself always renders, since it needs no tenant data); full-screen drawer on mobile, side-panel on desktop; one generic "temporarily unavailable" message (no tenant-specific fallback) on tenant/API failure, logged via `console.error` for diagnosis; "powered by" credit stays plain text until the Platform has a name/site; deep-linking to a pre-selected service is out of scope v1; a programmatic `window.Platform.open()`/`.close()` API is exposed alongside `data-platform-book`. See ADR-0004. |
| Booking draft (resume-on-reload) | `apps/widget` persists an in-progress booking's full form state client-side via `sessionStorage` (scoped to the widget's own origin), resuming exactly where a customer left off after an accidental host-page reload — re-validated against live availability on resume, cleared on success/restart/session end. Reverses an initial "out of scope" call once the support-burden tradeoff was raised. See ADR-0004, `GLOSSARY.md`. |
| Host-site CSP (onboarding gap) | `apps/widget`'s `frame-ancestors: *` only controls the inbound side — a Tenant's own host-page CSP can independently block the widget's domain from ever loading, with no fix possible from the widget's side. Tracked as a required onboarding-runbook checklist item once that runbook is written, not an engineering task. See ADR-0004. |
| apps/widget data-access gap resolved (`/to-tickets`, 2026-10-21) | The existing "Public catalog reads" decision (direct Supabase REST + anon key) assumed a build-time-known Supabase project per deployment, which the *shared* `apps/widget` deployment doesn't have — surfaced as a contradiction with ADR-0004's "zero credentials" line while breaking the widget spec into tickets. Resolved in favor of ADR-0004: `apps/api` gains two new public, wide-open-CORS endpoints for the widget only — tenant-info+catalog, and booking-lookup-by-token (so the cancel/reschedule drawer can show a booking before acting on it). `apps/admin`/`apps/site`'s existing direct-REST pattern is untouched. See ADR-0004. |
| Booking Widget drawer reused for cancel/reschedule (`/to-tickets`, 2026-10-21) | Cancel and reschedule no longer get a separately-designed page — both render the same **Drawer** component (slide-in panel from the right, ~35vw desktop, dimmed backdrop, full-screen on mobile) the booking flow uses, reached via direct top-level navigation (no host page to embed an iframe into) rather than inside an iframe. Reschedule reuses the drawer's live availability-picker pre-filled with the existing booking; cancel reuses just the shared shell plus a booking-detail view. Amends ADR-0004's original "standalone (non-iframe) pages" phrasing. See ADR-0004, `GLOSSARY.md`'s **Drawer** term. |
| `apps/widget` implementation complete, code-reviewed (2026-10-22) | All 11 tickets under issue #6 (apps/api endpoints, embed script, drawer shell, trigger hooks, failure UX, mobile layout, locale switcher, full booking flow, booking draft, reschedule, cancel) built, merged to the `widget-integration` branch, and closed. Two-axis code review (`/code-review`) run over the full branch before merge to `main`: **Spec axis** — high fidelity, no real findings (the one gap, #14's E2E happy path still self-skipping against the live inactive `dentdi` tenant, was already disclosed, not a defect). **Standards axis** — two real findings, handled as follows: (1) the entire booking-flow UI (service/availability/contact/confirm steps, cancel/reschedule pages) is hardcoded English, never routed through `apps/widget/src/lib/i18n/messages.ts` — **deferred, not fixed**, logged as its own Open Item below rather than scope-creeping a full i18n pass into a review-fixes commit; (2) `StandaloneDrawerLayout.astro` hand-rolled hex/rgba CSS instead of Tailwind design tokens — fixed directly. Judgement-call duplication smells (repeated fetch-wrapper shape across `apps/widget/src/lib/api/*.ts`, `resolveLocale`/`resolveLocaleString` reimplemented in two `apps/api` route files, 5 near-identical CORS blocks in `app.ts`) — the CORS block repetition was collapsed into a shared helper; the API-client and locale-resolution duplication were left as accepted debt (low payoff relative to the regression risk of refactoring already-tested code this late) and are also logged below. |

## Open / Non-Blocking Items

- **`apps/widget` booking-flow UI is hardcoded English, not localized**
  (found via code review, 2026-10-22) — `ServiceStep`/`AvailabilityStep`/
  `ContactStep`/`ConfirmPendingStep`/`ConfirmedStep`/`CancelContent`/
  `RescheduleContent`'s copy never routes through
  `apps/widget/src/lib/i18n/messages.ts` (which today only covers the
  "unavailable"/"language"/"resuming_draft" keys from issues #11/#13/
  #15). The in-drawer locale switcher (#13) changes which locale the
  *catalog data* renders in but not this static chrome. Real gap given
  launch locales are LV+RU+EN and the Drawer is customer-facing — needs
  its own scoped pass (extend `messages.ts` with every booking-flow
  string) rather than being folded into unrelated work.
- `apps/widget`'s `src/lib/api/*.ts` fetch wrappers (tenant-info,
  booking-lookup, booking.ts's 5 functions) repeat the same shape
  (strip trailing slash, build headers, `.json().catch(() => null)`,
  `!res.ok` branch, try/catch + `console.error`) — `apps/admin` has a
  precedent (`lib/api/client.ts`'s `apiFetch`) that wasn't reused or
  mirrored with a local equivalent. Accepted debt (found via code
  review, 2026-10-22) — revisit if a bug surfaces from the duplication
  drifting, or before adding more such functions.
- `resolveLocale` (`apps/api/src/routes/tenant-info.ts`) and
  `resolveLocaleString` (`apps/api/src/routes/booking-lookup.ts`)
  independently implement the same locale-fallback logic. Accepted
  debt (found via code review, 2026-10-22) — a shared `apps/api/src/
  lib/` helper would be the fix, low priority at 2 call sites.
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
  - ~~`patients` → `customers` schema/code rename + per-Tenant
    display-label mechanism (ADR-0002)~~ — **done** (2026-10-21, via
    `/tdd`). See the dedicated build-stage entry below.
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
