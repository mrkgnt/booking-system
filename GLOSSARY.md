# Dent Di Booking Platform — Domain Glossary

The product: a config-driven marketing-site-plus-booking-system sold to
small, staff-based appointment businesses (dental/medical, grooming,
salons, hairdressers). Each paying business runs on its own fully
isolated infrastructure; the product is sold and onboarded by hand, not
through self-serve signup.

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
dental) and needs one word that fits all of them. The schema's `patients`
table is being renamed to match (see decision below).
_Avoid_: Patient (dental-specific — survives only as a per-tenant
*display label*, not the domain term), Client (reserved for Tenant-side
ambiguity, not reused here).

**Display label**:
A per-tenant-configurable UI string that lets staff see vertical-appropriate
language (e.g. a dental Tenant's staff see "Patients" in their admin UI,
a salon Tenant's staff see "Clients") even though the underlying domain
term and schema are generic (`Customer`). Decouples vocabulary from data
model.

**Platform**:
The product itself — the shared codebase, infrastructure pattern, and
business sold to every Tenant. Name not yet chosen (placeholder: "the
Platform"). Distinct from any one Tenant's own brand.

## Commercial Terms

**Setup fee**:
A one-time charge to a Tenant for onboarding (initial site build, config,
content entry). Invoiced through Stripe, separately from the Monthly fee.

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
