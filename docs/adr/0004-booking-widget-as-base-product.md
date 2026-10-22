# Booking Widget as the base product; `apps/site` as an optional add-on

The platform was originally scoped as one marketing site + booking system
per Tenant (`apps/site`, ADR-0003). A grilling session on `apps/site`
surfaced that many prospective Tenants already have their own website and
don't want a full replacement — they just want booking capability added
to what they have. We decided the base, universal product is the
**Booking Widget**: an iframe-embeddable drawer, installed on any
third-party site via a single `<script>` tag, regardless of that site's
stack. `apps/site` (the full custom site) becomes an optional,
separately-priced add-on — what ADR-0003 already described, now scoped
down from "what every Tenant gets" to "what a Tenant can additionally
buy."

**Why**: every Tenant needs booking capability; not every Tenant needs or
wants a new site. Building the widget as the default keeps the baseline
offer cheap and fast to deliver (no redesign cost), while still letting a
Tenant like Dent Di (WordPress being decommissioned anyway) buy the full
`apps/site` build on top.

**Decision detail**:
- **Embedding mechanism**: iframe, not a Web Component or direct DOM
  injection. The host site's stack and CSS are unknown and uncontrollable
  — an iframe gives full isolation. `apps/widget`'s responses set a
  permissive `Content-Security-Policy: frame-ancestors *`, the opposite
  of the secure-by-default "deny framing" posture, because the whole
  mechanism depends on being frameable from an origin we can't know in
  advance.
- **Deployment model**: `apps/widget` is **one shared deployment** across
  every Tenant (tenant resolved at runtime from a `data-tenant` attribute
  in the embed snippet) — unlike `apps/admin`/`apps/site`'s per-tenant
  model (ADR-0003). This mirrors `apps/api`'s existing shared,
  dynamically-tenant-resolved pattern instead: onboarding a widget-only
  Tenant means adding a tenant-registry row, not standing up a new
  deployment.
- **Live content**: the iframe's drawer content (theme tokens, catalog,
  translations) is fetched fresh on each load, not baked at build time
  and not re-polled on an interval while the drawer stays open —
  consistent with the existing SSR approach already used for
  `apps/admin`.
- **CORS**: the public booking endpoints the widget calls (`/availability`,
  `/bookings`, etc.) get wide-open CORS (`Access-Control-Allow-Origin: *`)
  — necessary since the calling origin is unknown in advance, and judged
  low-risk because these endpoints are already unauthenticated and
  protected only by rate-limiting/Turnstile, the same posture already
  accepted for the public catalog reads.
- **Transactional pages**: cancel/reschedule links in confirmation
  emails point at pages served directly by `apps/widget`
  (`widget.platform.com/{tenant}/cancel`, etc.), used the same way for
  every Tenant tier — even full-site Tenants — rather than a Tenant's
  own site hosting them. A widget-only Tenant has no site of its own to
  host these on, so one mechanism for everyone avoids a special case.
  Mapping these onto a Tenant's own domain (e.g. a future
  `book.dentdi.lv`) is deferred until a Tenant actually asks for it.
  **Revised** (2026-10-21, during `/to-tickets` on the widget spec):
  these are no longer bare, visually-distinct pages — both reuse the
  Booking Widget's own **drawer** shell (the sliding panel + dimmed
  backdrop described below) rather than a separately-designed page, for
  visual consistency across all three customer actions (book, cancel,
  reschedule). Reschedule goes further and reuses the drawer's live
  availability-picker directly, pre-filled with the existing booking, so
  the customer picks a new slot the same way they'd pick one when
  booking. Cancel reuses just the shared shell plus a booking-detail
  view and a confirm button — it doesn't need the availability-picker.
  Technically these aren't *iframe* embeds, since there's no third-party
  host page to embed into on a direct email-link visit — the drawer
  component renders as the page's own top-level content instead, with
  the backdrop tinting the page's own generic background rather than a
  host site. "Standalone" now means "reached via direct top-level
  navigation," not "visually distinct from the drawer."
- **Trigger UX**: the embed script auto-injects a default floating
  "Book Now" bubble, with an opt-out flag for Tenants who'd rather wire
  their own existing CTA via a `data-platform-book` attribute — both
  work simultaneously, any number of custom triggers per page.
- **Relationship to `apps/site`**: `apps/site`, when a Tenant buys it,
  embeds the exact same public widget script as any third-party host
  site would — no shared booking-flow component code between the two
  apps, so the "no premature shared `packages/` workspace" call stands.
- **Iframe mount timing**: the floating trigger button is generic
  markup with no tenant-specific data, so it always renders regardless
  of tenant/API health; the booking iframe itself only mounts on first
  open (lazy, with a brief loading spinner) rather than loading in the
  background on every page view — keeps the embed's footprint on a
  Tenant's host page minimal for the common case of a visitor who never
  books.
- **`embed.js` release strategy**: served from a single always-latest
  URL, no per-tenant version pinning. Acceptable at the current
  agency-managed tenant scale (you control every install and smoke-test
  before a deploy); revisit if/when self-serve or a larger tenant count
  makes a bad shared deploy too risky to absorb.
- **Widget's own data access**: `apps/widget` holds no Supabase
  credentials of its own — it talks only to `apps/api`'s public
  endpoints, same as every other client of the booking API. Keeps
  `apps/api` the single gatekeeper to tenant data. **Resolved gap**
  (2026-10-21): this contradicted the existing "Public catalog reads"
  decision (direct Supabase REST + anon key, not proxied through Hono),
  which was written before a *shared* deployment like `apps/widget`
  existed — that pattern assumes a build-time-known Supabase project per
  deployment, which `apps/widget` doesn't have. Resolved in favor of
  this ADR's "zero credentials" line, not the older pattern:
  `apps/api` gains two new public, wide-open-CORS read endpoints the
  widget consumes instead — (1) Tenant display info (name, theme
  tokens, default/supported locales) plus the service/staff/category
  catalog, and (2) a booking-lookup-by-token endpoint (same
  token-validity rules as the existing cancel/reschedule mutations)
  so the cancel/reschedule drawer can show the existing booking before
  acting on it. `apps/admin`/`apps/site`'s existing direct-REST pattern
  is unaffected — this only applies to `apps/widget`'s new consumption.
- **Drawer visual design**: a panel that slides in from the right edge
  (~35vw on desktop), with the rest of the page overlaid by a
  dimmed/tinted backdrop to draw focus to it — one shared component
  used for all three customer-facing actions (book, cancel, reschedule).
- **Host-site CSP limitation**: `apps/widget`'s own `frame-ancestors`
  header only controls who's allowed to frame *it* — a Tenant's host
  page may separately run its own CSP (`frame-src`/`child-src`) that
  blocks the widget's domain from ever loading, and that's not fixable
  from the widget's side. Tracked as an onboarding runbook checklist
  item (verify the host site's CSP allows the widget domain before
  go-live), not an engineering task.
- **Mobile layout**: the drawer becomes a full-screen takeover on
  mobile viewports; desktop keeps the fixed-size side-panel drawer.
- **Failure/misconfiguration UX**: if the live content fetch fails —
  whether from an invalid/inactive tenant slug or a genuine API outage
  — opening the drawer shows one generic, locale-aware "temporarily
  unavailable" message (no tenant-specific fallback contact info is
  available, since that data is itself part of what failed to load).
  The real cause is logged via `console.error` for a developer to
  diagnose; nothing distinguishes the two cases for the customer.
- **"Powered by" credit**: renders as plain text, no link, until the
  Platform has a chosen name and a marketing site worth linking to.
- **Deep-linking to a pre-selected service** (e.g. a Tenant's own
  "Book Teeth Whitening" button opening the widget straight to
  availability for that service, skipping service-selection) is out of
  scope for v1 — `data-platform-book` always opens to the default first
  step. Clean additive enhancement for later.
- **Programmatic open/close API**: the embed script exposes
  `window.Platform.open()` / `.close()` in addition to the
  `data-platform-book` attribute hook, so a Tenant's own JavaScript can
  trigger the drawer too — `data-platform-book`'s click handling is
  sugar over the same call.
- **Booking draft (resume-on-reload)**: the in-progress booking form
  (service, staff, slot, contact info) is persisted client-side via
  `sessionStorage`, scoped to the widget's own origin, so a customer
  who accidentally reloads the host page resumes exactly where they
  left off. Resuming silently re-validates the previously-selected slot
  against live availability (nothing reserves a slot until the booking
  is actually created) and falls back to the availability step if it's
  since been taken. Cleared on successful booking creation, an explicit
  restart, or simply by the browser tab/session ending — no separate
  TTL on top of that. Reverses an initial "out of scope" call once the
  support-burden tradeoff (fewer "my form reset, can you help?"
  messages) was weighed against the added complexity.

**Considered and rejected**:
- Web Component / direct DOM injection for the embed — rejected: real
  risk of colliding with an unknown host site's own CSS/JS globals, with
  no way to debug that remotely.
- Per-tenant deployment for the widget, mirroring `apps/admin`/`apps/site`
  — rejected: would turn onboarding a widget-only Tenant into a
  deployment event for no benefit.
- A shared `packages/` workspace so `apps/widget` and `apps/site` share
  booking-flow component code — rejected as premature; dogfooding the
  public embed script accomplishes the same goal without the shared-code
  abstraction.

**Consequences**:
- A new deployable artifact, `apps/widget` — Astro + React, `output:
  "server"` (SSR), same stack as `apps/admin`, self-contained per the
  existing "no shared packages" call. Not yet scaffolded.
- Setup fee is redefined to cover Booking Widget integration as the
  baseline every Tenant gets; a Site build (`apps/site`) is priced
  separately, scoped by page count/complexity. See `GLOSSARY.md`,
  `PRODUCT.md`.
- Confirmation/cancellation emails now point at `apps/widget`'s own
  pages for every Tenant, not a Tenant's own site domain — and those
  pages render the same drawer component the embed uses, not a
  separate design.
- `apps/api` gains two new public endpoints (tenant-info + catalog;
  booking-lookup-by-token) purely to serve `apps/widget` — neither
  changes `apps/admin`/`apps/site`'s existing data-access patterns.
- ADR-0003 continues to correctly describe `apps/site`'s own per-tenant
  deployment shape; it no longer describes the default/required
  deliverable.
- Revisit custom-domain mapping for widget/transactional pages if a
  Tenant requests it.
- The onboarding runbook (not yet written) must include a host-site
  CSP check for the widget domain before go-live.
- `apps/widget` carries no Supabase credentials — only a public-facing
  dependency on `apps/api`'s existing endpoints.
- A new client-side-only domain concept, **Booking draft**, exists
  purely as browser `sessionStorage` state — never synced to a
  Tenant's database or visible to staff. See `GLOSSARY.md`.
