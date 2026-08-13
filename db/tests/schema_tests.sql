-- ============================================================================
-- Schema test suite — db/tenant-schema.sql
-- ============================================================================
-- Run against a project that already has tenant-schema.sql applied and
-- (ideally) db/seed.sql loaded. Every test is self-contained: destructive
-- actions run inside a SAVEPOINT that gets rolled back, so running this
-- file never permanently changes data. Safe to re-run any time.
--
-- Currently run manually via the Supabase MCP execute_sql tool (no
-- DATABASE_URL / service-role key is available in this environment to wire
-- up an automated vitest+supabase-js runner). Once the Hono API project
-- exists with real env-based credentials, this SQL can be adapted into
-- CI-run integration tests, or kept as-is and invoked via `psql -f`.
-- ============================================================================

create temporary table if not exists test_results (
  seq serial,
  test_name text,
  passed boolean,
  detail text
);
truncate test_results;

-- ---------------------------------------------------------------------------
-- 1. business_profile singleton enforced
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into business_profile (slug, name) values ('second-business', 'Second Business');
    insert into test_results (test_name, passed, detail)
      values ('business_profile singleton enforced', false, 'second row insert unexpectedly succeeded');
  exception when unique_violation then
    insert into test_results (test_name, passed, detail)
      values ('business_profile singleton enforced', true, null);
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. roles.key uniqueness
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    insert into roles (key, label) values ('owner', 'Duplicate Owner');
    insert into test_results (test_name, passed, detail)
      values ('roles.key uniqueness enforced', false, 'duplicate key insert unexpectedly succeeded');
  exception when unique_violation then
    insert into test_results (test_name, passed, detail)
      values ('roles.key uniqueness enforced', true, null);
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 3. bookings.idempotency_key uniqueness
-- ---------------------------------------------------------------------------
do $$
declare
  v_patient uuid;
  v_service uuid;
  v_existing_key text;
begin
  select id into v_patient from patients limit 1;
  select id into v_service from services limit 1;
  select idempotency_key into v_existing_key from bookings where idempotency_key is not null limit 1;

  if v_patient is null or v_service is null or v_existing_key is null then
    insert into test_results (test_name, passed, detail)
      values ('bookings.idempotency_key uniqueness enforced', false, 'skipped: no seed data to test against (run db/seed.sql first)');
  else
    begin
      insert into bookings (patient_id, service_id, starts_at, ends_at, locale, idempotency_key)
        values (v_patient, v_service, now(), now() + interval '30 minutes', 'en', v_existing_key);
      insert into test_results (test_name, passed, detail)
        values ('bookings.idempotency_key uniqueness enforced', false, 'duplicate idempotency_key insert unexpectedly succeeded');
    exception when unique_violation then
      insert into test_results (test_name, passed, detail)
        values ('bookings.idempotency_key uniqueness enforced', true, null);
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. bookings.status check constraint
-- ---------------------------------------------------------------------------
do $$
declare
  v_patient uuid;
  v_service uuid;
begin
  select id into v_patient from patients limit 1;
  select id into v_service from services limit 1;

  if v_patient is null or v_service is null then
    insert into test_results (test_name, passed, detail)
      values ('bookings.status check constraint enforced', false, 'skipped: no seed data (run db/seed.sql first)');
  else
    begin
      insert into bookings (patient_id, service_id, starts_at, ends_at, locale, status)
        values (v_patient, v_service, now(), now() + interval '30 minutes', 'en', 'not_a_real_status');
      insert into test_results (test_name, passed, detail)
        values ('bookings.status check constraint enforced', false, 'invalid status insert unexpectedly succeeded');
    exception when check_violation then
      insert into test_results (test_name, passed, detail)
        values ('bookings.status check constraint enforced', true, null);
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. translations composite uniqueness (entity_type, entity_id, locale, field)
-- ---------------------------------------------------------------------------
do $$
declare
  v_entity_id uuid;
begin
  select entity_id into v_entity_id from translations where entity_type = 'service' limit 1;

  if v_entity_id is null then
    insert into test_results (test_name, passed, detail)
      values ('translations composite uniqueness enforced', false, 'skipped: no seed data (run db/seed.sql first)');
  else
    begin
      insert into translations (entity_type, entity_id, locale, field, value)
        values ('service', v_entity_id, 'en', 'name', 'duplicate name');
      insert into test_results (test_name, passed, detail)
        values ('translations composite uniqueness enforced', false, 'duplicate (entity_type, entity_id, locale, field) insert unexpectedly succeeded');
    exception when unique_violation then
      insert into test_results (test_name, passed, detail)
        values ('translations composite uniqueness enforced', true, null);
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. staff_services composite PK dedup
-- ---------------------------------------------------------------------------
do $$
declare
  v_staff_id uuid;
  v_service_id uuid;
begin
  select staff_id, service_id into v_staff_id, v_service_id from staff_services limit 1;

  if v_staff_id is null then
    insert into test_results (test_name, passed, detail)
      values ('staff_services composite PK dedup enforced', false, 'skipped: no seed data (run db/seed.sql first)');
  else
    begin
      insert into staff_services (staff_id, service_id) values (v_staff_id, v_service_id);
      insert into test_results (test_name, passed, detail)
        values ('staff_services composite PK dedup enforced', false, 'duplicate (staff_id, service_id) insert unexpectedly succeeded');
    exception when unique_violation then
      insert into test_results (test_name, passed, detail)
        values ('staff_services composite PK dedup enforced', true, null);
    end;
  end if;
end $$;

-- Destructive tests below need a real rollback of test-setup rows, but
-- PL/pgSQL has no SAVEPOINT/ROLLBACK TO statement. Standard workaround:
-- run the destructive part in a nested begin/exception block and force it
-- to abort via a sentinel exception — the implicit subtransaction that
-- begin/exception creates gets rolled back, while outer-scope variables
-- (declared once, assigned inside the nested block) survive because plpgsql
-- variables aren't part of the rolled-back transaction state.

-- ---------------------------------------------------------------------------
-- 7. patients -> bookings cascade delete
-- ---------------------------------------------------------------------------
do $$
declare
  v_patient_id uuid;
  v_service_id uuid;
  v_booking_id uuid;
  v_before int;
  v_after int;
begin
  select id into v_service_id from services limit 1;

  begin
    insert into patients (name) values ('CASCADE TEST PATIENT') returning id into v_patient_id;
    insert into bookings (patient_id, service_id, starts_at, ends_at, locale)
      values (v_patient_id, v_service_id, now(), now() + interval '30 minutes', 'en')
      returning id into v_booking_id;

    select count(*) into v_before from bookings where id = v_booking_id;
    delete from patients where id = v_patient_id;
    select count(*) into v_after from bookings where id = v_booking_id;

    raise exception using errcode = 'P0001', message = 'rollback_sentinel';
  exception when others then
    if sqlerrm != 'rollback_sentinel' then
      raise;
    end if;
  end;

  insert into test_results (test_name, passed, detail)
    values ('patients delete cascades to bookings', v_before = 1 and v_after = 0,
      format('before=%s after=%s', v_before, v_after));
end $$;

-- ---------------------------------------------------------------------------
-- 8. staff delete is blocked (RESTRICT) when referenced by a booking
-- ---------------------------------------------------------------------------
do $$
declare
  v_staff_id uuid;
  v_patient_id uuid;
  v_service_id uuid;
  v_blocked boolean := false;
begin
  select id into v_service_id from services limit 1;

  begin
    insert into staff (name) values ('CASCADE TEST STAFF') returning id into v_staff_id;
    insert into patients (name) values ('RESTRICT TEST PATIENT') returning id into v_patient_id;
    insert into bookings (patient_id, service_id, staff_id, starts_at, ends_at, locale)
      values (v_patient_id, v_service_id, v_staff_id, now(), now() + interval '30 minutes', 'en');

    begin
      delete from staff where id = v_staff_id;
    exception when foreign_key_violation then
      v_blocked := true;
    end;

    raise exception using errcode = 'P0001', message = 'rollback_sentinel';
  exception when others then
    if sqlerrm != 'rollback_sentinel' then
      raise;
    end if;
  end;

  insert into test_results (test_name, passed, detail)
    values ('staff delete blocked by referencing booking (no ON DELETE clause = RESTRICT)', v_blocked,
      case when v_blocked then null else 'delete unexpectedly succeeded' end);
end $$;

-- ---------------------------------------------------------------------------
-- 9. staff -> staff_services / business_hours cascade delete (no bookings)
-- ---------------------------------------------------------------------------
do $$
declare
  v_staff_id uuid;
  v_service_id uuid;
  v_ss_before int;
  v_ss_after int;
  v_bh_before int;
  v_bh_after int;
begin
  select id into v_service_id from services limit 1;

  begin
    insert into staff (name) values ('CASCADE TEST STAFF 2') returning id into v_staff_id;
    insert into staff_services (staff_id, service_id) values (v_staff_id, v_service_id);
    insert into business_hours (staff_id, day_of_week, opens_at, closes_at) values (v_staff_id, 1, '09:00', '17:00');

    select count(*) into v_ss_before from staff_services where staff_id = v_staff_id;
    select count(*) into v_bh_before from business_hours where staff_id = v_staff_id;

    delete from staff where id = v_staff_id;

    select count(*) into v_ss_after from staff_services where staff_id = v_staff_id;
    select count(*) into v_bh_after from business_hours where staff_id = v_staff_id;

    raise exception using errcode = 'P0001', message = 'rollback_sentinel';
  exception when others then
    if sqlerrm != 'rollback_sentinel' then
      raise;
    end if;
  end;

  insert into test_results (test_name, passed, detail)
    values ('staff delete cascades to staff_services + business_hours',
      v_ss_before = 1 and v_ss_after = 0 and v_bh_before = 1 and v_bh_after = 0,
      format('staff_services before=%s after=%s, business_hours before=%s after=%s', v_ss_before, v_ss_after, v_bh_before, v_bh_after));
end $$;

-- ---------------------------------------------------------------------------
-- 10-16. Access control tests via SET ROLE. Postgres enforces table-level
-- GRANTs and RLS policies independently and in that order — a query only
-- gets through if it clears both layers. anon has a narrow, explicit GRANT
-- for the public catalog tables only (services/service_categories/staff/
-- business_hours/translations) and nothing else; authenticated has full
-- CRUD grants on every table, gated by is_active_member() through RLS.
-- ---------------------------------------------------------------------------

-- 10. anon cannot read patients (PII) — no grant at all on this table
do $$
declare
  v_count int;
  v_blocked boolean := false;
  v_reason text;
begin
  begin
    set local role anon;
    select count(*) into v_count from patients;
    reset role;
    v_blocked := (v_count = 0);
    v_reason := format('anon saw %s rows', v_count);
  exception when insufficient_privilege then
    reset role;
    v_blocked := true;
    v_reason := 'blocked at GRANT level (no SELECT privilege for anon)';
  end;
  insert into test_results (test_name, passed, detail)
    values ('anon blocked from reading patients (PII)', v_blocked, v_reason);
end $$;

-- 11. anon cannot read bookings — no grant at all on this table
do $$
declare
  v_count int;
  v_blocked boolean := false;
  v_reason text;
begin
  begin
    set local role anon;
    select count(*) into v_count from bookings;
    reset role;
    v_blocked := (v_count = 0);
    v_reason := format('anon saw %s rows', v_count);
  exception when insufficient_privilege then
    reset role;
    v_blocked := true;
    v_reason := 'blocked at GRANT level (no SELECT privilege for anon)';
  end;
  insert into test_results (test_name, passed, detail)
    values ('anon blocked from reading bookings', v_blocked, v_reason);
end $$;

-- 12. anon CAN read the public catalog directly (deliberate design choice —
-- see PROJECT_CONTEXT.md / CLAUDE.md: nothing here is sensitive, so the
-- booking widget reads it straight from Supabase rather than proxying
-- through the Hono API).
do $$
declare
  v_services int;
  v_categories int;
  v_staff int;
  v_hours int;
  v_translations int;
begin
  set local role anon;
  select count(*) into v_services from services;
  select count(*) into v_categories from service_categories;
  select count(*) into v_staff from staff;
  select count(*) into v_hours from business_hours;
  select count(*) into v_translations from translations;
  reset role;

  insert into test_results (test_name, passed, detail)
    values ('anon can read public catalog (services/categories/staff/hours/translations)',
      v_services > 0 and v_categories > 0 and v_staff > 0 and v_hours > 0 and v_translations > 0,
      format('services=%s categories=%s staff=%s hours=%s translations=%s', v_services, v_categories, v_staff, v_hours, v_translations));
end $$;

-- 13. anon cannot WRITE to the catalog — read-only grant only
do $$
declare
  v_blocked boolean := false;
begin
  begin
    set local role anon;
    insert into services (category_id, duration_minutes) values (null, 10);
    reset role;
  exception when insufficient_privilege then
    reset role;
    v_blocked := true;
  end;
  insert into test_results (test_name, passed, detail)
    values ('anon blocked from writing to services (SELECT-only grant)', v_blocked,
      case when v_blocked then null else 'insert unexpectedly succeeded' end);
end $$;

-- 14. inactive services are hidden from anon (RLS filters is_active = true)
do $$
declare
  v_service_id uuid;
  v_visible_before boolean;
  v_visible_after boolean;
begin
  begin
    insert into services (duration_minutes, is_active) values (20, true) returning id into v_service_id;

    set local role anon;
    select exists(select 1 from services where id = v_service_id) into v_visible_before;
    reset role;

    update services set is_active = false where id = v_service_id;

    set local role anon;
    select exists(select 1 from services where id = v_service_id) into v_visible_after;
    reset role;

    raise exception using errcode = 'P0001', message = 'rollback_sentinel';
  exception when others then
    if sqlerrm != 'rollback_sentinel' then
      raise;
    end if;
  end;

  insert into test_results (test_name, passed, detail)
    values ('anon only sees is_active=true services', v_visible_before = true and v_visible_after = false,
      format('visible while active=%s, visible after deactivation=%s', v_visible_before, v_visible_after));
end $$;

-- 15. authenticated role with no matching active business_member row is
-- blocked by RLS (reaches the policy check now that grants exist — a bare
-- JWT isn't enough, must be an active member row)
do $$
declare
  v_count int;
begin
  set local role authenticated;
  select count(*) into v_count from bookings;
  reset role;
  insert into test_results (test_name, passed, detail)
    values ('authenticated non-member blocked from reading bookings (via RLS, not grant)', v_count = 0,
      format('authenticated saw %s rows', v_count));
end $$;

-- 16. is_active_member() cannot be called anonymously as an RPC
do $$
declare
  v_blocked boolean := false;
begin
  begin
    set local role anon;
    perform is_active_member();
    reset role;
  exception when insufficient_privilege then
    reset role;
    v_blocked := true;
  end;
  insert into test_results (test_name, passed, detail)
    values ('anon cannot execute is_active_member() RPC', v_blocked,
      case when v_blocked then null else 'call unexpectedly succeeded' end);
end $$;

-- ---------------------------------------------------------------------------
-- 17. bookings_no_overlap exclusion constraint blocks a genuinely
-- overlapping booking for the same staff member, but allows a
-- non-overlapping one (sanity check the constraint isn't overly broad)
-- ---------------------------------------------------------------------------
do $$
declare
  v_service_id uuid;
  v_staff_id uuid;
  v_patient_a uuid;
  v_patient_b uuid;
  v_patient_c uuid;
  v_overlap_blocked boolean := false;
  v_adjacent_allowed boolean := false;
begin
  select id into v_service_id from services limit 1;
  select id into v_staff_id from staff limit 1;

  begin
    insert into patients (name) values ('OVERLAP CONSTRAINT TEST A') returning id into v_patient_a;
    insert into bookings (patient_id, service_id, staff_id, starts_at, ends_at, locale)
      values (v_patient_a, v_service_id, v_staff_id, '2027-03-01T10:00:00Z', '2027-03-01T10:30:00Z', 'en');

    insert into patients (name) values ('OVERLAP CONSTRAINT TEST B') returning id into v_patient_b;
    begin
      insert into bookings (patient_id, service_id, staff_id, starts_at, ends_at, locale)
        values (v_patient_b, v_service_id, v_staff_id, '2027-03-01T10:15:00Z', '2027-03-01T10:45:00Z', 'en');
    exception when exclusion_violation then
      v_overlap_blocked := true;
    end;

    -- Adjacent (touching, not overlapping) booking for the same staff
    -- should be allowed — tstzrange is half-open [start, end), so back
    -- to back appointments are legitimate, not a conflict.
    insert into patients (name) values ('OVERLAP CONSTRAINT TEST C') returning id into v_patient_c;
    begin
      insert into bookings (patient_id, service_id, staff_id, starts_at, ends_at, locale)
        values (v_patient_c, v_service_id, v_staff_id, '2027-03-01T10:30:00Z', '2027-03-01T11:00:00Z', 'en');
      v_adjacent_allowed := true;
    exception when exclusion_violation then
      v_adjacent_allowed := false;
    end;

    raise exception using errcode = 'P0001', message = 'rollback_sentinel';
  exception when others then
    if sqlerrm != 'rollback_sentinel' then
      raise;
    end if;
  end;

  insert into test_results (test_name, passed, detail)
    values ('bookings_no_overlap blocks genuine overlap, allows adjacent slots',
      v_overlap_blocked and v_adjacent_allowed,
      format('overlap_blocked=%s adjacent_allowed=%s', v_overlap_blocked, v_adjacent_allowed));
end $$;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
select test_name, passed, detail from test_results order by seq;
