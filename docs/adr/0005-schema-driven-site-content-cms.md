# Schema-driven Site Content CMS for `apps/site`

`apps/site` is being redesigned to 1:1-replicate a richer reference
design, which introduced marketing copy with no existing home in the
schema (hero headline, about paragraphs, a stats row, a testimonial
card, a value-props checklist, a gallery image list, social-contact
links). A grilling session on this redesign decided: a small, generic,
**schema-driven** two-table CMS (`site_sections` + `site_content`),
editable by a Tenant's own staff via a new `apps/admin` screen — not
hardcoded into Astro components, and not a single catch-all content
system that also re-homes service/staff/hours/contact data that
already has a canonical table.

**Why**: narrows scope to the actual gap (only the copy with nowhere
else to live), reuses every existing pattern (admin staff auth/RLS,
per-tenant schema, public reads) instead of inventing a parallel
content pipeline, and makes adding a new Section later a data change
(one `site_sections` row) rather than an admin-UI code change too.

**Decision detail**:
- **Two tables, generic across every Tenant**, added to
  `db/tenant-schema.sql` (not a Dent-Di-only one-off), per the existing
  "CMS/CRM feature scope must stay config-driven/generic" principle:
  - `site_sections(page_slug, section_key, display_order, fields
    jsonb)` — the schema *definition*. Developer-written, changes only
    when a Section is added/changed in code. `fields` is
    `[{ key, label, type: "text"|"textarea"|"image", required,
    localized }]`.
  - `site_content(page_slug, locale, content jsonb)` — the actual
    *values*. Tenant-editable, written often. `content` is
    `{ [section_key]: { [field_key]: value } }`.
  - A `localized: false` field (images, phone/social links) is entered
    once and reused across all three locales; only `localized: true`
    fields (real copy) vary per locale row.
- **Access**: the new "Site Content" `apps/admin` screen uses the same
  access control as every other `/admin/*` route — any active staff
  member via the existing `is_active_member()` RLS check. No new
  owner-only tier.
- **Scope boundary**: `service_categories`/`services`/`staff`/
  `business_hours`/`business_profile` stay the single source of truth
  for that data. `apps/site` reads them the same way `apps/widget`'s
  `/public/tenant-info` and `apps/admin`'s existing screens already do.
  Site Content covers only copy with no existing schema home.
- **Validation**: required-field enforcement happens in the admin
  form, plus a basic non-empty check server-side in the `apps/api`
  route — not a full dynamic zod-schema generator built from the
  `fields` definition.
- **No `audit_log` entry** for Site Content edits — matches the
  existing precedent that catalog/scheduling edits also don't write
  one (an already-accepted gap elsewhere in this repo).
- **`apps/site` reverts to `output: "server"` (SSR)** from the static
  output it shipped with one build earlier, so a Tenant's save is
  reflected on next page load with no rebuild/redeploy step —
  consistent with how `apps/admin`/`apps/widget` already do live reads.

**Considered and rejected**:
- A single catch-all content table covering everything, including
  services/team/hours — rejected: would duplicate data that already
  has a canonical home, creating two sources of truth that could drift.
- A fully normalized `site_content(page_slug, section_key, field_key,
  locale, value)` (one row per field) — rejected in favor of one JSON
  blob per page+locale: simpler to build and administer for what's
  explicitly meant to be lightweight, at the cost of being less
  queryable per-field — acceptable, since nothing needs to query an
  individual field outside the page it belongs to.
- A hardcoded admin form per Section (dedicated form code per section
  type) — rejected in favor of schema-driven generic rendering: adding
  a Section would otherwise mean editing the Astro template *and*
  separately duplicating its field list into admin-UI code, a real
  drift risk the schema-driven approach avoids.
- Developer-only editing (content changes via a PR, no new UI) —
  rejected: the Tenant explicitly wants to update their own site
  content without going through a developer each time.

**Consequences**:
- `apps/site` gains an SSR deployment requirement (`@astrojs/node`
  adapter, `output: "server"`) — this reverses the static-output
  judgment call recorded in CLAUDE.md's immediately-preceding
  `apps/site` build-stage entry; that entry's rationale should now be
  read as superseded by this ADR, not as still-current.
- `apps/api` gains new `/admin/site-content` routes (schema read,
  content read/write), following the existing per-request staff-JWT
  Supabase client pattern every other `/admin/*` route already uses.
- `apps/site`'s own **public** read of `site_content` most likely
  follows the existing "Public catalog reads" pattern (direct Supabase
  REST + anon key, scoped `GRANT`+RLS) rather than proxying through
  `apps/api` — not fully settled by this ADR, to be confirmed at
  `/to-spec` time.
- New `apps/admin` UI: a generic form renderer keyed by field `type`
  (`text`/`textarea`/`image` only — no file upload, no rich-text
  editor).
- `GLOSSARY.md` gains two new terms: **Section** and **Site Content**.
