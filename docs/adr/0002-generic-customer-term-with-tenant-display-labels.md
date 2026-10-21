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

**Status**: implemented and fully verified (2026-10-21). Schema rename
applied live to the Dent Di project; `apps/api` and `apps/admin` fully
updated; display-label mechanism built and wired through every
staff-facing string. Verified via 108/108 api vitest + clean `tsc`,
44/44 admin vitest + clean `astro check`/`tsc`, a live
`db/tests/schema_tests.sql` run (17/17), and a live Playwright E2E run
with Dent Di's `business_profile.site_config.customerLabel` set to
`{"singular":"Patient","plural":"Patients"}` — `customers.spec.ts`'s
both tests pass clean. No open work remains on this decision.

**Consequences**: touched (and renamed) the `patients` table → `customers`,
generated TypeScript types, admin API routes (`admin-patients.ts` →
`admin-customers.ts` and friends), the admin UI's Patients screen →
`CustomersScreen`/`CustomerDetailScreen`, and the `patients.spec.ts` E2E
spec → `customers.spec.ts`. The display-label mechanism is a new, small
piece of per-tenant config (`business_profile.site_config.customerLabel`,
resolved by `resolveCustomerLabel()`) — distinct from the existing
`translations` table, since this is a staff-facing operational label,
not end-customer-facing content.
