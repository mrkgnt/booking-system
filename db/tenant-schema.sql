-- ============================================================================
-- Booking CRM Platform — Per-Tenant Schema Template
-- Target: Supabase (Postgres + RLS + Auth) — ONE PROJECT PER CLIENT
-- ============================================================================
-- Architecture: every client gets their own Supabase project. This file is
-- the template migration run once per new client project. There is no
-- business_id anywhere — isolation is physical (separate project, separate
-- Auth, separate database), not row-level.
--
-- This does NOT eliminate the need for RLS within a project: RLS here scopes
-- "authenticated staff member of this business" vs. "anonymous/service-role
-- caller." The public booking flow still goes through the backend's service
-- role key (bypasses RLS) — that boundary is unchanged from the shared-DB
-- design.
--
-- Requires, going forward (not deferrable once client #2 exists):
--   - A migration runner that applies schema changes across every client
--     project, not just this one.
--   - A project registry (client -> Supabase project URL + encrypted
--     service key + status) — the "back office" mentioned in planning.
--     Out of scope for this file; only matters once there's a #2.
--
-- site_config / theme_tokens live on `business_profile`, a singleton table
-- (exactly one row) so each client's own project still gets config-driven
-- rendering, just scoped to itself instead of a shared businesses table.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. BUSINESS PROFILE (singleton — exactly one row per project)
-- ============================================================================

create table business_profile (
  is_singleton boolean primary key default true check (is_singleton),
  slug text not null,
  name text not null,
  default_locale text not null default 'en',
  supported_locales text[] not null default array['en'],
  timezone text not null default 'UTC',
  currency text not null default 'EUR',
  contact_email text,
  contact_phone text,
  address text,
  site_config jsonb not null default '{}'::jsonb,
  theme_tokens jsonb not null default '{}'::jsonb,
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'suspended')),
  updated_at timestamptz not null default now()
);

-- 2. AUTH / ROLES

create table roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- 'owner' | 'staff' | future custom keys
  label text not null,
  permissions jsonb not null default '[]'::jsonb, -- reserved for future granularity
  created_at timestamptz not null default now()
);

create table business_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references roles(id),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- ============================================================================
-- 3. I18N
-- ============================================================================

create table translations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null, -- 'service' | 'service_category' | 'staff' | 'testimonial' | 'gallery_item' | 'site_section' | 'booking_form_field'
  entity_id uuid,
  locale text not null,
  field text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, locale, field)
);

create index idx_translations_lookup on translations (entity_type, entity_id, locale);

-- ============================================================================
-- 4. CATALOG
-- ============================================================================

create table service_categories (
  id uuid primary key default gen_random_uuid(),
  icon text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references service_categories(id) on delete set null,
  duration_minutes int not null,
  buffer_minutes_before int not null default 0,
  buffer_minutes_after int not null default 0,
  price_amount numeric(10, 2),
  price_currency text not null default 'EUR',
  price_prefix text not null default 'exact' check (price_prefix in ('exact', 'from', 'up_to')),
  display_order int not null default 0,
  is_active boolean not null default true,
  external_refs jsonb not null default '{}'::jsonb, -- e.g. {"paytraq": "12345"}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references business_members(id) on delete set null,
  name text not null,
  photo_url text,
  display_order int not null default 0,
  is_active boolean not null default true,
  is_bookable boolean not null default true,
  created_at timestamptz not null default now()
);

create table staff_services (
  staff_id uuid not null references staff(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- ============================================================================
-- 5. SCHEDULING
-- ============================================================================

create table business_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade, -- null = business-wide default
  day_of_week int not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table closures (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade, -- null = whole business
  starts_on date not null,
  ends_on date not null,
  reason text,
  is_recurring_yearly boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 6. BOOKING CORE
-- ============================================================================

create table patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text,
  preferred_locale text,
  consent_given_at timestamptz,
  external_refs jsonb not null default '{}'::jsonb, -- e.g. {"paytraq": "98765"}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_patients_phone on patients (phone);
create index idx_patients_email on patients (email);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  service_id uuid not null references services(id),
  staff_id uuid references staff(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  locale text not null,
  description text,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'confirmed', 'completed', 'cancelled', 'no_show')),
  source text not null default 'public' check (source in ('public', 'admin_manual')),
  idempotency_key text unique,
  consent_given_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references business_members(id),
  sent_to_accounting_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_time on bookings (staff_id, starts_at, ends_at);
create index idx_bookings_patient on bookings (patient_id);

create table booking_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  purpose text not null check (purpose in ('confirm', 'cancel', 'reschedule')),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_verification_token_lookup on booking_verification_tokens (token_hash);

-- ============================================================================
-- 7. OPS
-- ============================================================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_member_id uuid references business_members(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  template text not null,
  locale text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. INTEGRATIONS
-- ============================================================================

create table tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique, -- 'paytraq' | 'google_calendar' | 'microsoft_graph' | 'caldav'
  credentials_encrypted bytea,
  status text not null default 'disabled' check (status in ('disabled', 'active', 'error')),
  connected_by uuid references business_members(id),
  connected_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table staff_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'icloud')),
  external_account_email text,
  sync_status text not null default 'disconnected',
  webhook_channel_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (staff_id, provider)
);

create table external_busy_blocks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  source text not null check (source in ('google', 'microsoft', 'icloud', 'manual')),
  external_event_id text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 9. updated_at triggers
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_business_profile_updated_at before update on business_profile
  for each row execute function set_updated_at();
create trigger trg_services_updated_at before update on services
  for each row execute function set_updated_at();
create trigger trg_patients_updated_at before update on patients
  for each row execute function set_updated_at();
create trigger trg_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================
-- Single-tenant per project now, so the check simplifies to "is this user an
-- active member of THIS business" — no business_id parameter needed.

create or replace function is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from business_members bm
    where bm.user_id = auth.uid()
      and bm.status = 'active'
  );
$$;

-- is_active_member() only needs to run for authenticated requests (it's
-- what "members access X" policies below evaluate for the authenticated
-- role); anon has no business calling it directly either. Revoking here
-- keeps the anon-facing catalog policies below from ever touching this
-- function, and avoids exposing it as a public RPC endpoint.
revoke execute on function is_active_member() from public;
grant execute on function is_active_member() to authenticated;

alter table business_profile enable row level security;
alter table roles enable row level security;
alter table business_members enable row level security;
alter table translations enable row level security;
alter table service_categories enable row level security;
alter table services enable row level security;
alter table staff enable row level security;
alter table staff_services enable row level security;
alter table business_hours enable row level security;
alter table closures enable row level security;
alter table patients enable row level security;
alter table bookings enable row level security;
alter table booking_verification_tokens enable row level security;
alter table audit_log enable row level security;
alter table notification_log enable row level security;
alter table tenant_integrations enable row level security;
alter table staff_calendar_connections enable row level security;
alter table external_busy_blocks enable row level security;

-- Policies are explicitly scoped "to authenticated" — without this they'd
-- default to PUBLIC (all roles, including anon), which would make Postgres
-- evaluate is_active_member() for anon too and throw "permission denied"
-- once EXECUTE on that function is restricted to authenticated above.
create policy "members access business_profile" on business_profile
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access roles" on roles
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access business_members" on business_members
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access translations" on translations
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access service_categories" on service_categories
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access services" on services
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access staff" on staff
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access staff_services" on staff_services
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access business_hours" on business_hours
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access closures" on closures
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access patients" on patients
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access bookings" on bookings
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access verification_tokens" on booking_verification_tokens
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access audit_log" on audit_log
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access notification_log" on notification_log
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access tenant_integrations" on tenant_integrations
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access staff_calendar_connections" on staff_calendar_connections
  for all to authenticated using (is_active_member()) with check (is_active_member());
create policy "members access external_busy_blocks" on external_busy_blocks
  for all to authenticated using (is_active_member()) with check (is_active_member());

-- RLS enable + a "for all" policy is not, on its own, enough for an
-- authenticated business member to reach a table — Postgres checks
-- table-level GRANTs before RLS is ever evaluated. Grant what the
-- policies above already assume.
grant select, insert, update, delete on business_profile to authenticated;
grant select, insert, update, delete on roles to authenticated;
grant select, insert, update, delete on business_members to authenticated;
grant select, insert, update, delete on translations to authenticated;
grant select, insert, update, delete on service_categories to authenticated;
grant select, insert, update, delete on services to authenticated;
grant select, insert, update, delete on staff to authenticated;
grant select, insert, update, delete on staff_services to authenticated;
grant select, insert, update, delete on business_hours to authenticated;
grant select, insert, update, delete on closures to authenticated;
grant select, insert, update, delete on patients to authenticated;
grant select, insert, update, delete on bookings to authenticated;
grant select, insert, update, delete on booking_verification_tokens to authenticated;
grant select, insert, update, delete on audit_log to authenticated;
grant select, insert, update, delete on notification_log to authenticated;
grant select, insert, update, delete on tenant_integrations to authenticated;
grant select, insert, update, delete on staff_calendar_connections to authenticated;
grant select, insert, update, delete on external_busy_blocks to authenticated;

-- ============================================================================
-- 11. PUBLIC CATALOG READ ACCESS (anon)
-- ============================================================================
-- The booking widget browses the catalog directly via Supabase REST rather
-- than proxying reads through the backend API — nothing in these tables is
-- sensitive (service names/prices, staff names, business hours), so this
-- trades no real security for a simpler/faster public read path. Everything
-- patient/booking-related stays fully locked to authenticated members only
-- (no grant to anon at all, above).

grant select on service_categories to anon;
grant select on services to anon;
grant select on staff to anon;
grant select on business_hours to anon;
grant select on translations to anon;

-- Only active/published rows are public.
create policy "public read active service_categories" on service_categories
  for select to anon using (is_active = true);
create policy "public read active services" on services
  for select to anon using (is_active = true);
create policy "public read active bookable staff" on staff
  for select to anon using (is_active = true);
create policy "public read business_hours" on business_hours
  for select to anon using (true);

-- Scoped to known public-content entity types, so a future entity_type
-- isn't accidentally made public by default (secure-by-default, not
-- open-by-default) — nothing patient/booking-related is expected to ever
-- live in this table, but the allowlist protects against that regardless.
create policy "public read catalog translations" on translations
  for select to anon
  using (
    entity_type in (
      'service', 'service_category', 'staff',
      'testimonial', 'gallery_item', 'site_section', 'booking_form_field'
    )
  );

insert into business_profile (slug, name) values ('replace-me', 'Replace Me') ;
insert into roles (key, label) values ('owner', 'Owner'), ('staff', 'Staff');
