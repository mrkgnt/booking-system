# Generic "Customer" domain term, with per-tenant display labels

The schema's `patients` table used dental-specific vocabulary, but the
platform is sold broadly to staff-based appointment businesses (grooming,
salons, hairdressers), not just medical ones. We decided to rename the
domain concept to the generic **Customer** (schema: `patients` →
`customers`), rather than keep dental-specific naming or fork the schema
per vertical.

**Why**: keeps `PROJECT_CONTEXT.md`'s "config-driven, not forked code"
principle intact as new verticals sign up with real data. Renaming now
(seed data only, pre-launch, no client #2 yet) is cheap; retrofitting it
onto live booking data later would not be. Staff still need
vertical-appropriate wording, so the UI label is decoupled from the
domain term: a per-tenant-configurable **display label** (e.g. Dent Di's
admin UI keeps showing "Patients") sits on top of the generic `Customer`
concept.

**Status**: decided, not yet implemented. The schema/code rename and the
display-label config mechanism are still open work — see `PRODUCT.md`'s
open items and `CLAUDE.md`'s build stage.

**Consequences**: touches the `patients` table, generated TypeScript
types, admin API routes (`admin-patients.ts` and friends), the admin UI's
Patients screen, and the `patients.spec.ts` E2E spec. The display-label
mechanism is a new, small piece of per-tenant config — distinct from the
existing `translations` table, since this is a staff-facing operational
label, not end-customer-facing content.
