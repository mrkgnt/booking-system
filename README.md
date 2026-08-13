# booking-system

Multi-tenant SaaS booking platform for small service businesses (dental/medical
practices, groomers, salons). Marketing site + booking widget, configured per
business through data. First client: Dent Di (dentdi.lv), a Latvian dental
clinic.

See `CLAUDE.md` for current build state and active decisions, and
`PROJECT_CONTEXT.md` for full architecture/product background.

- `db/tenant-schema.sql` — per-tenant Supabase schema template (one project
  per client; applied once to each new client's project).
