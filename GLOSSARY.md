# Dent Di Booking Platform — Domain Glossary

The product: a booking system sold to small, staff-based appointment
businesses (dental/medical, grooming, salons, hairdressers), delivered to
every Tenant as an embeddable Booking Widget that plugs into any existing
website — a full custom site (Site build) is an optional add-on, not the
default. Each paying business runs on its own fully isolated
infrastructure; the product is sold and onboarded by hand, not through
self-serve signup.

## Language

**Tenant**:
A business that has signed up for the platform. Each Tenant gets one
dedicated Supabase project (its own database, Auth, storage) — full
isolation, not a row scoped by a shared `business_id`.
_Avoid_: Client (ambiguous with "Customer" below), Account.

**Business**:
The schema/code-level name for the same concept as Tenant (the
`business_profile` table). Kept as-is in code rather than renamed, since
each Supabase project holds exactly one Business/Tenant — the two words
name the same thing from different vantage points (infrastructure vs.
schema).

**Customer**:
A person who books an appointment with a Tenant. The canonical domain
term, chosen because the product sells to multiple verticals (not just
dental) and needs one word that fits all of them. The schema's `customers`
table (renamed from `patients` 2026-10-21, ADR-0002).
_Avoid_: Patient (dental-specific — survives only as a per-tenant
*display label*, not the domain term), Client (reserved for Tenant-side
ambiguity, not reused here).

**Display label**:
A per-tenant-configurable UI string that lets staff see vertical-appropriate
language (e.g. a dental Tenant's staff see "Patients" in their admin UI,
a salon Tenant's staff see "Clients") even though the underlying domain
term and schema are generic (`Customer`). Decouples vocabulary from data
model. Implemented as `business_profile.site_config.customerLabel`,
resolved by `resolveCustomerLabel()` (`apps/api/src/lib/customer-label.ts`)
and exposed via `GET /admin/me`.

**Platform**:
The product itself — the shared codebase, infrastructure pattern, and
business sold to every Tenant. Name not yet chosen (placeholder: "the
Platform"). Distinct from any one Tenant's own brand.

**Booking Widget**:
The base product every Tenant gets: an iframe-embeddable booking drawer,
installed on any existing website (any stack) via a single `<script>`
tag. Schema/code: `apps/widget`, one shared deployment across every
Tenant (ADR-0004) — unlike the per-tenant deployment model used for
`apps/admin`/`apps/site` (ADR-0003).
_Avoid_: "the site", "the embed" (both ambiguous with Site build below).

**Site build**:
An optional, separately-priced add-on: a full custom marketing site
(`apps/site`) built for a Tenant on their own domain, deliberately
minimal in scope (a design showcase more than a full CMS), which embeds
the same Booking Widget as any other host site rather than its own
booking-flow code (ADR-0004). Not every Tenant buys this — Dent Di does,
since their WordPress site is being decommissioned.
_Avoid_: conflating with the Booking Widget — a Tenant can have a Site
build without needing one, or vice versa (a Tenant with no Site build
still gets the Booking Widget as the baseline).

**Booking draft**:
A customer's in-progress booking-flow state (selected service, staff,
slot, contact info) held client-side in the Booking Widget's own
`sessionStorage` — never synced to a Tenant's database, never visible
to staff. Lets a customer who accidentally reloads the host page resume
exactly where they left off; the previously-selected slot is
re-validated against live availability on resume, since nothing
reserves a slot until the booking is actually created. Cleared on
successful booking creation, an explicit restart, or when the browser
tab/session ends (ADR-0004).
_Avoid_: "saved booking", "pending booking" (both imply server-side
state — a Booking draft is a browser-only convenience, not a domain
object).

**Drawer**:
The Booking Widget's sliding-panel UI: slides in from the right edge
(~35vw on desktop, full-screen takeover on mobile) over a dimmed/tinted
backdrop of the surrounding page. One shared component reused for all
three customer-facing actions — book, cancel, reschedule (ADR-0004).
Rendered inside an iframe when embedded on a Tenant's own host page;
rendered as the page's own top-level content when reached directly via
an email link (cancel/reschedule), since there's no host page to embed
into in that case.

## Commercial Terms

**Setup fee**:
A one-time charge to a Tenant for onboarding, covering Booking Widget
integration as the baseline every Tenant gets. A Site build is priced
separately on top, scoped by page count/complexity — not bundled into
the Setup fee. Invoiced through Stripe, separately from the Monthly fee.

**Monthly fee**:
A recurring charge to a Tenant covering hosting/infrastructure costs,
maintenance, and minor config tweaks within existing tokens (e.g.
adjusting hours, swapping a theme color). Net-new feature work is scoped
and billed separately, not covered by this fee.
_Avoid_: Support fee, subscription (used loosely in conversation, but
"Monthly fee" is the term of record).

**Grace period**:
The window after a Tenant stops paying or cancels, during which their
site stays live and a data export is offered, before the Tenant's
Supabase project is scheduled for teardown.

**Tenant contract**:
The standard, reusable agreement every Tenant signs — covers the Setup
fee, Monthly fee, Grace period, and data retention terms identically
across Tenants, rather than improvised per client. Functions as the
Data Processing Agreement (DPA): the Tenant is the Data Controller of
their own Customers' data; the Platform is the Data Processor.

## Open naming decision

- **Platform name**: not yet chosen. Using "the Platform" as a
  placeholder in docs until a name is picked.
