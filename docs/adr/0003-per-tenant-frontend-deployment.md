# One deployment per tenant for apps/admin and apps/site

`apps/api` is already a single shared deployment that resolves the
tenant dynamically per-request (`X-Tenant-Slug` header →
`resolveTenant()`). `apps/admin` is the opposite: `TENANT_SLUG` is a
build-time env var baked into one deployment per tenant. `apps/site` (the
public marketing site) doesn't exist yet. Onboarding a second tenant
forces a real choice here, so we made it explicitly: both `apps/admin`
and the future `apps/site` stay **one deployment per tenant**, each on
the tenant's own custom domain — not a refactor toward a shared
multi-tenant frontend.

**Why**: consistent with the full-isolation-per-tenant philosophy already
chosen for Supabase (see `PROJECT_CONTEXT.md`), requires no refactor of
the existing admin app, and the public site needs its own custom domain
per tenant regardless (e.g. `dentdi.lv`). Under the agency-managed
operating model (ADR-0001), redeploying per client is a small, bounded
cost — the alternative is a real multi-tenant frontend refactor with no
payoff until tenant count is much higher than it is now.

**Considered and rejected**: a shared `apps/admin` deployment resolving
tenant by login or subdomain, and a shared multi-domain `apps/site`
deployment. Both are more "SaaS-shaped" but solve a scaling problem that
doesn't exist yet.

**Consequences**: every admin/site code change needs redeploying once
per tenant — deployment automation (CI/CD) becomes more valuable as
tenant count grows. `apps/api` remains the one exception: genuinely
shared and multi-tenant-aware today. Revisit this ADR if per-tenant
redeployment becomes the actual bottleneck.
