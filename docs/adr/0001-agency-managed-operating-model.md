# Agency-managed operating model, not self-serve SaaS

The platform could have been built for self-serve signup (a stranger
signs up, a tenant is provisioned automatically) or for agency-managed
onboarding (every tenant is sold and provisioned by hand). We chose
agency-managed, indefinitely — not as an interim stage before self-serve,
but as the standing model.

**Why**: at solo-developer, few-tenants scale, manual onboarding is
already required by the per-tenant Supabase provisioning model (see
`PROJECT_CONTEXT.md`'s rationale for one dedicated project per client).
Building self-serve signup, automated tenant provisioning, trial flows,
and in-app billing automation would be speculative infrastructure with
no tenant count to justify it.

**Consequences**:
- `tenant-registry.ts` stays a hardcoded in-memory map until tenant count
  actually forces a real registry — not DB-backed in anticipation of
  self-serve.
- Billing runs through Stripe operationally (dashboard-driven invoices
  and subscriptions), with no webhook integration in `apps/api`.
- Internal tenant tracking (which projects exist, billing/contract
  status) stays a spreadsheet, not an in-app back-office tool.
- Revisit if tenant count or onboarding effort makes manual provisioning
  the actual bottleneck — see `PRODUCT.md`.
