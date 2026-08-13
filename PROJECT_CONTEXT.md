# Project Context — Multi-Tenant Booking CRM Platform

Background reference for the platform. This doesn't change often — active
build state and running decisions live in `CLAUDE.md`.

## Role

Technical co-builder on a multi-tenant SaaS platform giving small service
businesses (dental practices, medical/clinical offices, groomers,
hairdressers, salons, and similar appointment-based businesses) a marketing
website + booking system, configured per business through data — not
through forking code. Solo developer; favor pragmatic, maintainable
decisions over theoretically "perfect" ones.

## Core Architecture Principles

1. **Config-driven site** — which sections a business's site shows come
   from per-tenant config (JSONB); Astro renders conditionally. Never
   hand-write a one-off template for a specific client.
2. **Config-driven booking form** — date/time/service/description fields
   are all optional per tenant.
3. **Frontend stays simple** — resist scope creep into a full customer
   portal unless explicitly requested.
4. **Security-first on booking** — the public booking endpoint is
   unauthenticated and internet-facing; treat it as the primary
   abuse/DDoS surface from day one.
5. **Translatable by default** — every piece of business-entered content
   must support multiple languages.
6. **Theming via tokens, not templates** — every visual property compiles
   to CSS custom properties; a new look is a new token value, never a
   forked component or client-specific stylesheet.

## Why Per-Tenant Supabase Projects (not shared multi-tenant DB)

Originally scoped as one shared Supabase project with `business_id` on
every table and RLS-enforced tenant isolation. Superseded mid-planning in
favor of **one dedicated Supabase project per client** (separate database,
Auth, everything).

Rationale: Supabase Auth is project-scoped, and staff at one clinic never
need cross-tenant access — so shared Auth bought nothing, while isolation
meaningfully reduces blast radius for health-adjacent PII.

Tradeoffs knowingly accepted:
- Schema migrations and API deploys must work across N projects (tooling
  required starting at client #2, not deferrable).
- A lightweight project registry ("back office") will be built later to
  track which projects exist and their connection info.
- Operational simplicity (migration runner complexity at scale, cost
  multiplication per project) is traded for clean auth isolation — an
  explicitly evaluated and accepted tradeoff.

## Booking System Requirements

- Flow: select service → real-time available date/time → optional
  description → contact info → confirm.
- Availability always computed server-side — never trust a
  client-submitted slot. Must account for staff schedules, buffer times,
  existing bookings, cancellations, business hours/holidays.
- On booking create/cancel/modify, availability recalculates primarily via
  DB trigger → webhook (event-driven); Edge Function cron is a periodic
  reconciliation pass, not the primary mechanism.
- "Legit" confirmations require, at minimum:
  - Double opt-in (email/SMS verification token) before a booking is
    finalized, unless the client has an authenticated account
  - Idempotency keys to block double-submission
  - Rate limiting per IP/session on the booking-creation endpoint
  - Bot protection (e.g. Cloudflare Turnstile) on the public form
  - Signed, expiring confirmation/cancellation links

## Calendar Sync (deferred — see priority order in CLAUDE.md)

- Two-way: bookings push to the assigned staff member's Google/Outlook/
  iCloud calendar.
- External changes (staff blocks time manually, cancels externally) sync
  back and update availability — push/webhooks for Google and Microsoft
  Graph; CalDAV (iCloud) has no webhook support, needs polling.
- Supabase is always the source of truth; external calendars are a mirror
  plus a source of external blocks.

## Internationalization (i18n)

- Static UI strings (buttons, labels, error/success messages, nav) via
  Astro's i18n routing and locale JSON dictionaries, versioned in the
  codebase.
- Tenant-authored content (about text, service names/descriptions, staff
  bios, testimonials, gallery captions) stored per-locale in Supabase via
  a generic `translations` table — never baked into Astro templates.
- A business always has one default/fallback locale; missing translations
  fall back to it rather than showing a blank field.
- Locale switcher on the public site drives Astro's routing and is itself
  part of per-tenant config — a single-language business shouldn't show a
  switcher.
- Booking flow is locale-aware end to end: service names/descriptions
  render in the selected locale; confirmation emails/SMS go out in the
  client's chosen language, not the business's default.
- Admin/staff backend needs a way to add/edit translations per field —
  doesn't have to be fancy at first (a simple per-locale text input per
  field), but the schema should support adding languages without a
  migration.
- Date/time formatting and timezones respect locale conventions, not
  hardcoded to one format.

## Styling & Theming

- Everything a client might reasonably want to change is a token: colors
  (primary/secondary/accent/background/text/border), typography (curated
  font presets, base size scale), spacing scale, border radius, container
  max-width, column counts per grid section (services, gallery, staff,
  testimonials).
- Tokens live in tenant config alongside section toggles and i18n
  settings, compiling to CSS custom properties.
- One shared component library across every tenant. A look the current
  tokens can't produce means a new token/config option — never a one-off
  component fork or client-specific CSS file.
- Column counts/widths need sane bounds and mobile-safe defaults (clamp
  desktop columns to a small range, always collapse to 1 column below a
  fixed breakpoint).
- Sizing/spacing config offers a curated set mapped to the CSS library's
  own scale rather than free-form arbitrary values.

## Security Requirements

- DDoS/bot protection in front of both the public site and booking API
  (e.g. Cloudflare) — rate limiting and WAF rules specifically on booking
  and auth endpoints.
- Public clients never write to Supabase directly for bookings: the
  service role key stays server-side; public traffic goes through the
  backend API or narrowly-scoped RPC functions under RLS.
- Audit log every manual override (staff cancelling/rescheduling on a
  client's behalf).
- **Important:** the public/anonymous booking-creation flow goes through
  the backend's Supabase **service role key**, which bypasses RLS
  entirely. Tenant scoping on that path is enforced by the backend
  correctly selecting which tenant's Supabase project to talk to — not by
  Postgres. This is the single most important place for a routing bug to
  matter.

## Admin/Staff-Facing Backend — Must Support

- Full visibility into all bookings for the business (calendar + list
  views)
- Clientele management (profiles, booking history, notes)
- Receipt/invoice creation (via Paytraq, not built in-house — see below)
- Time-slot adjustments (manual blocks, staff hours/availability)
- Manual overrides (force-book, cancel, reschedule outside normal rules)

## First Client: Dent Di (dentdi.lv)

- Latvian dental clinic. 2 staff: 1 dentist, 1 nurse.
- Current site is WordPress — fully decommissioned at launch, no parallel
  run. Needs an SEO redirect map from old WP URLs before cutover (open
  item).
- A design/content reference (an Astro+React demo of the site) was
  supplied. **Not reusable code** — hand-rolled CSS, plus leftover
  Cloudflare Worker/wrangler scaffolding from whatever tool generated it
  (ignore that tooling entirely). Useful things extracted from it:
  - Sage green/cream palette, Georgia serif headings — the exact visual
    direction to build toward.
  - ~35 services across 6 categories with real EUR prices (accuracy not
    yet confirmed with client — open item).
  - Demo booking flow shape: service → calendar → time picker →
    name/phone → confirmation code → cancel/reschedule by code, with
    buffer times conceptually already modeled.
  - A "virtual administrator" FAQ chat widget was demoed as fake/canned
    buttons — real scope is rule-based, not AI (see Decisions Log in
    CLAUDE.md).
  - Site images were hotlinked from the live WordPress site — need real
    migration to Supabase Storage before launch.

## Paytraq Integration (accounting/invoicing)

- Auth: **Private Integration** — API Key/Token pair the business owner
  generates themselves in their own Paytraq account (My Paytraq → API
  Access). No OAuth app registration or callback whitelisting needed for
  a single-tenant integration.
- Rate limits: ~1 req/sec average, burst to 5, 5000/day — a non-issue at
  this scale.
- MVP scope:
  - `tenant_integrations` table stores the encrypted API key/token per
    tenant (already in schema).
  - One-time service → Paytraq item ID mapping, set during onboarding —
    implemented as `external_refs jsonb` on the `services` table (e.g.
    `{"paytraq": "12345"}`), not a separate mapping table.
  - Patient/client sync to Paytraq on first booking (create-or-find) —
    same pattern via `external_refs jsonb` on `patients`.
  - **Trigger is manual**: staff click "Send to Paytraq" after marking a
    booking complete. Deliberately not automatic — keeps a human in the
    loop before anything fiscal is written to the client's books.
- Explicitly deferred / out of scope: OAuth or public-app registration
  (only relevant if this becomes a listed integration other businesses
  connect their own account to), PayTraq Connect's webhook shortcut
  (using the real API directly instead), inventory/warehouse/supplier
  endpoints (irrelevant to a dental clinic).
- Paytraq is NOT the source of truth for services/pricing — Supabase is
  (it drives the booking widget). The mapping is one-directional: our
  service catalog → their item IDs, not the reverse.

## Schema Notes (see `db/tenant-schema.sql` for the actual DDL)

- `business_profile` — singleton (exactly one row), holds name, locale,
  timezone, currency, `site_config` JSONB (section toggles, booking-form
  field toggles, locale switcher visibility), `theme_tokens` JSONB
  (colors, typography, spacing, grid columns).
- `roles`, `business_members` — RBAC-shaped from the start, not a boolean
  flag; `business_members.user_id` references `auth.users`
  (project-local Supabase Auth).
- `translations` — generic i18n table: `entity_type`, `entity_id`
  (nullable, null = site-level singleton content), `locale`, `field`,
  `value`. Supports adding new languages without a schema migration.
- `service_categories`, `services`, `staff`, `staff_services` — catalog.
  `staff` is deliberately separate from `business_members` (a staff
  member shown on the public site doesn't need a login; an owner who
  never takes appointments doesn't need a staff row) — link is optional
  via `staff.member_id`.
- `business_hours`, `closures` — scheduling, both support an optional
  `staff_id` (null = business-wide default).
- `patients`, `bookings`, `booking_verification_tokens` — booking core.
  Verification tokens store a **hash**, never the raw token (signed,
  expiring confirm/cancel/reschedule links). `bookings.idempotency_key`
  is unique to block double-submission. `bookings.locale` captures the
  client's chosen language at booking time, independent of the
  business's default.
- `audit_log` — every manual staff override (force-book, cancel,
  reschedule outside normal rules) writes here.
- `notification_log` — delivery tracking per channel (email/sms) and
  template (double_opt_in/confirmation/reminder/cancellation).
- `tenant_integrations`, `staff_calendar_connections`,
  `external_busy_blocks` — schema-only stubs for calendar sync and
  Paytraq, not wired up yet. Exist now so nothing needs schema surgery
  later.
- RLS: `is_active_member()` — no parameter needed (single tenant per
  project). Policies are intentionally permissive between `owner`/`staff`
  for MVP since granular permission enforcement isn't built yet — tighten
  against `roles.permissions` if/when a tenant needs finer-grained
  access.

## Working Agreement

- Before writing UI or schema, check the tenant config shape — assume any
  field can be toggled off unless told otherwise.
- If a styling request can't be satisfied by an existing token, propose
  adding a new token to the shared system rather than writing
  tenant-specific CSS or forking a component.
- Flag open decisions rather than silently picking: final API hosting
  choice, SMS provider, deposits/payments at booking time, staff
  role/permission granularity, locale set at launch, whether theme tokens
  are ever made editable by the business owner.
- When proposing a language/framework change from the decided defaults,
  state the tradeoff briefly before switching.
