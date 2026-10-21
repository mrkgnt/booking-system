# Product & Business Model

What's being sold, to whom, how, and under what terms — resolved via a
grilling + domain-modeling session (2026-10-21). Companion to
`PROJECT_CONTEXT.md` (technical architecture/background), `GLOSSARY.md`
(domain language), and `docs/adr/` (the architecturally-shaped decisions
this session produced). `CLAUDE.md` tracks current build state and links
here rather than duplicating it.

## Positioning

- **What**: a config-driven marketing site + booking system + light
  CRM/CMS for staff-based appointment businesses.
- **Who**: dental/medical practices, groomers, hairdressers, salons —
  broadly, any appointment business with staff and bookable slots. Not
  narrowed to medical-only.
- **How sold**: agency-managed (ADR-0001) — sold and onboarded by hand,
  indefinitely. No self-serve signup, no automated tenant provisioning,
  no trial flow.
- **First Tenant**: Dent Di (dental clinic, Latvia). Features get built
  dentistry-first by necessity, but must stay generic/config-driven in
  shape (per `PROJECT_CONTEXT.md` principle #1) so later tenants in other
  verticals aren't blocked by dental-specific assumptions.

## Feature List

### Public site (per Tenant — `apps/site`, not yet built)
- Config-driven marketing site: toggleable sections, theme tokens.
- Full i18n per `PROJECT_CONTEXT.md`.
- Light "powered by [Platform]" credit.
- Public booking flow: service → availability → contact info → double
  opt-in confirm → cancel/reschedule by signed link.
- One deployment per Tenant, each on the Tenant's own custom domain
  (ADR-0003).

### Admin/staff backend (per Tenant — `apps/admin`, built for Dent Di today)
- Bookings: list/filter, force-book, cancel, reschedule, dashboard +
  calendar + stats.
- Lightweight CRM: Customer profile, booking history, staff notes — no
  lead pipelines, campaigns, or segmentation.
- Catalog CRUD: service categories, services, staff, staff↔service
  linking.
- Scheduling: business hours, closures.
- One deployment per Tenant (ADR-0003); Supabase-Auth-based staff login,
  RLS as the authorization boundary.

### Integrations (optional per Tenant)
- Paytraq (accounting/invoicing) — Latvia-specific, toggled on only for
  Tenants that use it (`tenant_integrations`). Manual "send to Paytraq"
  trigger, not automatic.
- Calendar sync (Google/Microsoft/CalDAV) — deferred; schema stubs
  exist.

### Explicitly out of scope / deferred (revisit only on real demand)
- Self-serve signup, trials, automated tenant provisioning.
- Client-facing CMS editor — content/theme stays developer-configured at
  onboarding.
- CRM pipelines, marketing campaigns/email blasts, customer
  segmentation.
- In-app billing integration (Stripe webhooks, auto-suspension on
  non-payment).
- In-app multi-tenant back-office tool — stays a spreadsheet.
- Tiered pricing packages (Starter/Pro) — one flat bundle for now.
- Multi-currency/region-agnostic billing and translated contract
  templates.

## Commercial Model

- **Pricing**: a one-time Setup fee + a recurring Monthly fee, both
  invoiced through Stripe (dashboard-driven; no API/webhook integration
  in the codebase).
- **Monthly fee covers**: hosting/infra costs (bundled — the Platform
  retains sole ownership of all Tenant infrastructure; Tenants never get
  direct Supabase/hosting access), bug fixes/maintenance, and minor
  config tweaks within existing tokens. Net-new features are scoped and
  invoiced separately.
- **Support**: one dedicated support email, best-effort response — no
  formal uptime SLA or penalty clause at this stage.
- **Tenant contract / DPA**: one standard template, signed identically by
  every Tenant. States:
  - **Termination/offboarding**: a grace period (~14 days, exact number
    not finalized) after non-payment or cancellation before the site
    goes offline and the Supabase project is scheduled for teardown; a
    data-export offer precedes teardown.
  - **Data retention**: Customer/booking records retained indefinitely
    while the Tenant is active (no automatic purge timer); purged within
    ~90 days of contract end. Cancelled bookings are not separately
    time-purged — they're ordinary customer history until then.
  - **Data roles**: the Tenant is the Data Controller of their own
    Customers' data; the Platform is the Data Processor.
- **Geographic scope**: implicitly Latvia/Baltics-focused (EUR, Latvian-
  aware contract language) for now. Expand opportunistically — don't
  build region-agnostic billing/legal infrastructure speculatively.

## Operational Model

- Every Tenant is onboarded by hand (ADR-0001) — indefinitely, not an
  interim stage.
- Tenant tracking stays a spreadsheet (name, Supabase project ref,
  contract/billing status) until tenant count makes that unwieldy.
- An onboarding runbook (Supabase project creation → schema apply →
  seed/theme/content entry → DNS → staff accounts → go-live) is a
  tracked deliverable — not yet written.

## Terminology

See `GLOSSARY.md` for canonical domain terms: **Tenant**, **Business**,
**Customer**, **Display label**, **Platform**, and the Commercial Terms
section (**Setup fee**, **Monthly fee**, **Grace period**, **Tenant
contract**).

## Open items from this concept pass

- Platform product name — not yet chosen (placeholder: "the Platform").
- Onboarding runbook — not yet written.
- Tenant contract/DPA template — not yet drafted.
- Exact grace-period length — illustrative ~14 days, not finalized.
