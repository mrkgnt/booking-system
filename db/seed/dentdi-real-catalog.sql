-- ============================================================================
-- Dent Di's REAL catalog — hand-authored, not generated.
--
-- Unlike db/seed/generate-seed.ts's output (db/seed.sql), this is NOT
-- synthetic/Faker data and is NOT a reusable per-tenant template — it's
-- Dent Di's actual 6-category / 18-item price list, transcribed from their
-- live WordPress site (dentdi.lv, being decommissioned) and cross-checked
-- item-by-item against the three live price-list pages on 2026-10-22
-- (?page_id=489 [LV], =298 [RU], =560 [EN]) — all 18 prices matched
-- exactly, no drift from the subset already curated into
-- apps/site/src/content/{lv,ru,en}.ts during the earlier apps/site build.
--
-- Run db/seed/purge-catalog.sql immediately before this (clears the
-- Faker-seeded service_categories/services/staff_services/translations
-- rows this replaces, plus the bookings that FK-reference those services).
-- Safe to re-run after that purge.
--
-- ---------------------------------------------------------------------------
-- Duration / buffer judgment calls (ticket #26 — WordPress has no duration
-- field, so these are chosen defaults, not scraped data):
--   Consultations   20-45 min | buffer 5-10 / 10   (talk + maybe X-ray)
--   Hygiene         20-60 min | buffer 5-10 / 10-15 (chairside cleaning time)
--   Therapy         45-90 min | buffer 10-15 / 10-15 (filling vs. root canal)
--   Prosthetics     60-90 min | buffer 15 / 15       (crown/denture fitting)
--   Oral surgery    45-120 min| buffer 10-15 / 15-20 (extra recovery/cleanup
--                                                      buffer after)
--   Orthodontics    30-45 min | buffer 5-10 / 10      (fitting/scanning)
-- Per-item values below vary within each band by real clinical complexity
-- (e.g. a single-surface filling vs. a root canal are both "Therapy" but
-- not the same chair time).
--
-- Staff linkage judgment call: Dina Gnitecka (dentist) is linked to all 18
-- services — she's the sole dentist and the only one qualified for
-- diagnostic/restorative/surgical/orthodontic work. Olga Čursinova (nurse)
-- is linked ONLY to the 3 Hygiene items — routine cleaning/preventive work
-- is within a dental nurse's scope in this clinic; consultations, fillings,
-- root canals, prosthetics, extractions/implants, and orthodontics are not.
-- This mirrors db/seed/generate-seed.ts's original synthetic-data
-- convention ("nurse does short/preventive services").
--
-- The two staff rows are addressed by position (ordered by display_order),
-- NOT by name — their `staff.name` values were seeded by Faker and this
-- ticket's scope is service_categories/services only, not staff. VERIFY
-- before running:
--   select id, name, display_order, is_active from staff order by display_order;
-- must return exactly 2 active rows, with the dentist first (display_order
-- 0) and the nurse second (display_order 1) — true as of every staff seed
-- this schema's seed scripts have produced so far. If that's ever not the
-- case, fix the `rn = 1` / `rn = 2` assignment below before running.
-- ============================================================================

-- ---- Service categories ----------------------------------------------------

insert into service_categories (id, icon, display_order) values
  ('058e58ce-3428-4b0b-9afe-be079ce22e78', 'clipboard', 0), -- Consultations
  ('fd7d3156-1f49-439f-bc75-1a3f2b8676ec', 'sparkles', 1),  -- Hygiene
  ('75375556-ee72-405c-9c0a-1c491d09e890', 'tooth', 2),     -- Therapy
  ('a2691f78-81b0-4208-ab42-cd4c4276a40f', 'crown', 3),     -- Prosthetics
  ('583f0f74-3a0c-48c0-9e76-9412e7f86954', 'scalpel', 4),   -- Dental surgery
  ('4baf622e-65f1-40b3-8e8a-ea938370bc55', 'braces', 5);    -- Orthodontics

insert into translations (entity_type, entity_id, locale, field, value) values
  ('service_category', '058e58ce-3428-4b0b-9afe-be079ce22e78', 'lv', 'name', 'Konsultācijas'),
  ('service_category', '058e58ce-3428-4b0b-9afe-be079ce22e78', 'ru', 'name', 'Консультации'),
  ('service_category', '058e58ce-3428-4b0b-9afe-be079ce22e78', 'en', 'name', 'Consultations'),

  ('service_category', 'fd7d3156-1f49-439f-bc75-1a3f2b8676ec', 'lv', 'name', 'Mutes dobuma higiēna'),
  ('service_category', 'fd7d3156-1f49-439f-bc75-1a3f2b8676ec', 'ru', 'name', 'Гигиена'),
  ('service_category', 'fd7d3156-1f49-439f-bc75-1a3f2b8676ec', 'en', 'name', 'Hygiene'),

  ('service_category', '75375556-ee72-405c-9c0a-1c491d09e890', 'lv', 'name', 'Terapija'),
  ('service_category', '75375556-ee72-405c-9c0a-1c491d09e890', 'ru', 'name', 'Терапия'),
  ('service_category', '75375556-ee72-405c-9c0a-1c491d09e890', 'en', 'name', 'Therapy'),

  ('service_category', 'a2691f78-81b0-4208-ab42-cd4c4276a40f', 'lv', 'name', 'Protezēšana'),
  ('service_category', 'a2691f78-81b0-4208-ab42-cd4c4276a40f', 'ru', 'name', 'Протезирование'),
  ('service_category', 'a2691f78-81b0-4208-ab42-cd4c4276a40f', 'en', 'name', 'Prosthetics'),

  ('service_category', '583f0f74-3a0c-48c0-9e76-9412e7f86954', 'lv', 'name', 'Mutes ķirurģija'),
  ('service_category', '583f0f74-3a0c-48c0-9e76-9412e7f86954', 'ru', 'name', 'Хирургия'),
  ('service_category', '583f0f74-3a0c-48c0-9e76-9412e7f86954', 'en', 'name', 'Dental surgery'),

  ('service_category', '4baf622e-65f1-40b3-8e8a-ea938370bc55', 'lv', 'name', 'Ortodontija'),
  ('service_category', '4baf622e-65f1-40b3-8e8a-ea938370bc55', 'ru', 'name', 'Ортодонтия'),
  ('service_category', '4baf622e-65f1-40b3-8e8a-ea938370bc55', 'en', 'name', 'Orthodontics');

-- ---- Services ---------------------------------------------------------------
-- columns: id, category_id, duration_minutes, buffer_minutes_before,
--          buffer_minutes_after, price_amount, price_prefix, display_order

insert into services (id, category_id, duration_minutes, buffer_minutes_before, buffer_minutes_after, price_amount, price_prefix, display_order) values
  -- Consultations
  ('48f9892e-90f8-4e18-b774-ecaeb51a42a8', '058e58ce-3428-4b0b-9afe-be079ce22e78', 45, 10, 10, 64.00, 'exact', 0),
  ('78e72016-0353-44f7-929e-ed3fe50c0cdb', '058e58ce-3428-4b0b-9afe-be079ce22e78', 20, 5, 10, 25.00, 'exact', 1),
  ('f9edd698-1e63-4a2f-bb0d-ff5bd8914e24', '058e58ce-3428-4b0b-9afe-be079ce22e78', 30, 5, 10, 50.00, 'exact', 2),

  -- Hygiene
  ('a6960b8a-d8ac-47f7-ac93-d9aad3b1acd5', 'fd7d3156-1f49-439f-bc75-1a3f2b8676ec', 60, 10, 15, 70.00, 'exact', 0),
  ('d6eca1b5-0207-4d06-9b9e-31b7926a5366', 'fd7d3156-1f49-439f-bc75-1a3f2b8676ec', 45, 10, 10, 40.00, 'exact', 1),
  ('57f840bc-7d4a-43d3-9074-8822356287df', 'fd7d3156-1f49-439f-bc75-1a3f2b8676ec', 20, 5, 10, 8.00, 'exact', 2),

  -- Therapy
  ('052c78a8-0455-4435-bf9c-3a253374c20a', '75375556-ee72-405c-9c0a-1c491d09e890', 45, 10, 10, 90.00, 'exact', 0),
  ('c2d7f934-1ee7-4c55-81de-cc6933d444b8', '75375556-ee72-405c-9c0a-1c491d09e890', 75, 10, 15, 195.00, 'exact', 1),
  ('8256203a-7757-44a0-8db5-da87c86a4263', '75375556-ee72-405c-9c0a-1c491d09e890', 90, 15, 15, 88.00, 'exact', 2),

  -- Prosthetics
  ('7d13a019-7250-4501-ae9c-10ab01e46c65', 'a2691f78-81b0-4208-ab42-cd4c4276a40f', 90, 15, 15, 650.00, 'exact', 0),
  ('e0bb252c-9515-46c2-b717-9b70c8bc84f2', 'a2691f78-81b0-4208-ab42-cd4c4276a40f', 90, 15, 15, 520.00, 'exact', 1),
  ('0817398f-19d6-4397-a251-feb049cb3aae', 'a2691f78-81b0-4208-ab42-cd4c4276a40f', 60, 15, 15, 800.00, 'from', 2),

  -- Dental surgery
  ('66d814ba-1088-4f25-bc56-9b58f21f9d75', '583f0f74-3a0c-48c0-9e76-9412e7f86954', 45, 10, 15, 120.00, 'exact', 0),
  ('a5c0816f-fc7d-4910-8c6f-f04822069ace', '583f0f74-3a0c-48c0-9e76-9412e7f86954', 90, 15, 20, 800.00, 'exact', 1),
  ('73063ba5-8490-45c0-b3cf-86e9bf100324', '583f0f74-3a0c-48c0-9e76-9412e7f86954', 120, 15, 20, 800.00, 'from', 2),

  -- Orthodontics
  ('5e88a248-e673-49ba-a9bf-e580c2b3b2fc', '4baf622e-65f1-40b3-8e8a-ea938370bc55', 45, 10, 10, 1490.00, 'exact', 0),
  ('b399c385-d30c-4e33-ba44-95c4ae9734ea', '4baf622e-65f1-40b3-8e8a-ea938370bc55', 45, 10, 10, 3400.00, 'exact', 1),
  ('1295f2cb-86d4-48be-aa21-a1deb2fafa7a', '4baf622e-65f1-40b3-8e8a-ea938370bc55', 30, 5, 10, 200.00, 'from', 2);

insert into translations (entity_type, entity_id, locale, field, value) values
  -- Consultations
  ('service', '48f9892e-90f8-4e18-b774-ecaeb51a42a8', 'lv', 'name', 'Pirmreizējā konsultācija (apskate, RTG, ārstēšanas plāns)'),
  ('service', '48f9892e-90f8-4e18-b774-ecaeb51a42a8', 'ru', 'name', 'Первичная консультация (осмотр, RTG, план лечения)'),
  ('service', '48f9892e-90f8-4e18-b774-ecaeb51a42a8', 'en', 'name', 'Initial consultation (examination, X-ray, treatment plan)'),

  ('service', '78e72016-0353-44f7-929e-ed3fe50c0cdb', 'lv', 'name', 'Atkārtota konsultācija'),
  ('service', '78e72016-0353-44f7-929e-ed3fe50c0cdb', 'ru', 'name', 'Вторичная консультация'),
  ('service', '78e72016-0353-44f7-929e-ed3fe50c0cdb', 'en', 'name', 'Follow-up consultation'),

  ('service', 'f9edd698-1e63-4a2f-bb0d-ff5bd8914e24', 'lv', 'name', 'Ārstēšanas plāna sastādīšana'),
  ('service', 'f9edd698-1e63-4a2f-bb0d-ff5bd8914e24', 'ru', 'name', 'Составление плана лечения'),
  ('service', 'f9edd698-1e63-4a2f-bb0d-ff5bd8914e24', 'en', 'name', 'Drawing up a treatment plan'),

  -- Hygiene
  ('service', 'a6960b8a-d8ac-47f7-ac93-d9aad3b1acd5', 'lv', 'name', 'Pilna mutes dobuma higiēna ar instruktāžu'),
  ('service', 'a6960b8a-d8ac-47f7-ac93-d9aad3b1acd5', 'ru', 'name', 'Полная гигиена полости рта с инструктажем'),
  ('service', 'a6960b8a-d8ac-47f7-ac93-d9aad3b1acd5', 'en', 'name', 'Complete oral hygiene with instruction'),

  ('service', 'd6eca1b5-0207-4d06-9b9e-31b7926a5366', 'lv', 'name', 'Mīksta aplikuma noņemšana ar pulēšanu (visiem zobiem)'),
  ('service', 'd6eca1b5-0207-4d06-9b9e-31b7926a5366', 'ru', 'name', 'Снятие мягкого налета с полировкой (всех зубов)'),
  ('service', 'd6eca1b5-0207-4d06-9b9e-31b7926a5366', 'en', 'name', 'Removal of soft plaque and polishing (all teeth)'),

  ('service', '57f840bc-7d4a-43d3-9074-8822356287df', 'lv', 'name', 'Zoba pārklāšana ar emalju hermetizējošo šķidrumu (vienam zobam)'),
  ('service', '57f840bc-7d4a-43d3-9074-8822356287df', 'ru', 'name', 'Покрытие эмально-пломбировочным раствором (один зуб)'),
  ('service', '57f840bc-7d4a-43d3-9074-8822356287df', 'en', 'name', 'Fissure sealant coating (one tooth)'),

  -- Therapy
  ('service', '052c78a8-0455-4435-bf9c-3a253374c20a', 'lv', 'name', 'Plombēšana ar kompozītmateriālu (vienas virsmas apjomā)'),
  ('service', '052c78a8-0455-4435-bf9c-3a253374c20a', 'ru', 'name', 'Пломбирование композитом (одна поверхность)'),
  ('service', '052c78a8-0455-4435-bf9c-3a253374c20a', 'en', 'name', 'Composite filling (one surface)'),

  ('service', 'c2d7f934-1ee7-4c55-81de-cc6933d444b8', 'lv', 'name', 'Plombēšana ar kompozītmateriālu (vairāk par trim virsmām)'),
  ('service', 'c2d7f934-1ee7-4c55-81de-cc6933d444b8', 'ru', 'name', 'Пломбирование композитом (более трёх поверхностей)'),
  ('service', 'c2d7f934-1ee7-4c55-81de-cc6933d444b8', 'en', 'name', 'Composite filling (more than three surfaces)'),

  ('service', '8256203a-7757-44a0-8db5-da87c86a4263', 'lv', 'name', 'Kanāla apstrāde (viens kanāls)'),
  ('service', '8256203a-7757-44a0-8db5-da87c86a4263', 'ru', 'name', 'Обработка одного канала'),
  ('service', '8256203a-7757-44a0-8db5-da87c86a4263', 'en', 'name', 'Root canal treatment (single canal)'),

  -- Prosthetics
  ('service', '7d13a019-7250-4501-ae9c-10ab01e46c65', 'lv', 'name', 'Cirkonija kronis (full)'),
  ('service', '7d13a019-7250-4501-ae9c-10ab01e46c65', 'ru', 'name', 'Циркониевая коронка (full)'),
  ('service', '7d13a019-7250-4501-ae9c-10ab01e46c65', 'en', 'name', 'Full zirconia crown'),

  ('service', 'e0bb252c-9515-46c2-b717-9b70c8bc84f2', 'lv', 'name', 'Porcelāna kronis (E.MAX)'),
  ('service', 'e0bb252c-9515-46c2-b717-9b70c8bc84f2', 'ru', 'name', 'Керамическая коронка (E.MAX)'),
  ('service', 'e0bb252c-9515-46c2-b717-9b70c8bc84f2', 'en', 'name', 'E.MAX ceramic crown'),

  ('service', '0817398f-19d6-4397-a251-feb049cb3aae', 'lv', 'name', 'Totāla izņemamā protēze'),
  ('service', '0817398f-19d6-4397-a251-feb049cb3aae', 'ru', 'name', 'Тотальный съёмный протез'),
  ('service', '0817398f-19d6-4397-a251-feb049cb3aae', 'en', 'name', 'Complete denture'),

  -- Dental surgery
  ('service', '66d814ba-1088-4f25-bc56-9b58f21f9d75', 'lv', 'name', 'Viensakņu zoba ekstrakcija'),
  ('service', '66d814ba-1088-4f25-bc56-9b58f21f9d75', 'ru', 'name', 'Удаление однокорневого зуба'),
  ('service', '66d814ba-1088-4f25-bc56-9b58f21f9d75', 'en', 'name', 'Single-root tooth extraction'),

  ('service', 'a5c0816f-fc7d-4910-8c6f-f04822069ace', 'lv', 'name', 'Viena implanta ievadīšana (Straumann)'),
  ('service', 'a5c0816f-fc7d-4910-8c6f-f04822069ace', 'ru', 'name', 'Установка одного импланта (Straumann)'),
  ('service', 'a5c0816f-fc7d-4910-8c6f-f04822069ace', 'en', 'name', 'Single implant placement (Straumann)'),

  ('service', '73063ba5-8490-45c0-b3cf-86e9bf100324', 'lv', 'name', 'Kaula transplantācija'),
  ('service', '73063ba5-8490-45c0-b3cf-86e9bf100324', 'ru', 'name', 'Трансплантация кости'),
  ('service', '73063ba5-8490-45c0-b3cf-86e9bf100324', 'en', 'name', 'Bone transplantation'),

  -- Orthodontics
  ('service', '5e88a248-e673-49ba-a9bf-e580c2b3b2fc', 'lv', 'name', 'Zobu taisnošana ar ORDOLINE kapēm (Easy)'),
  ('service', '5e88a248-e673-49ba-a9bf-e580c2b3b2fc', 'ru', 'name', 'Выравнивание зубов капами ORDOLINE (Easy)'),
  ('service', '5e88a248-e673-49ba-a9bf-e580c2b3b2fc', 'en', 'name', 'Ordoline aligners (Easy)'),

  ('service', 'b399c385-d30c-4e33-ba44-95c4ae9734ea', 'lv', 'name', 'Zobu taisnošana ar ORDOLINE kapēm (Complex)'),
  ('service', 'b399c385-d30c-4e33-ba44-95c4ae9734ea', 'ru', 'name', 'Выравнивание зубов капами ORDOLINE (Complex)'),
  ('service', 'b399c385-d30c-4e33-ba44-95c4ae9734ea', 'en', 'name', 'Ordoline aligners (Complex)'),

  ('service', '1295f2cb-86d4-48be-aa21-a1deb2fafa7a', 'lv', 'name', 'Zobu regulācijas ortodontiska plate'),
  ('service', '1295f2cb-86d4-48be-aa21-a1deb2fafa7a', 'ru', 'name', 'Ортодонтическая пластинка'),
  ('service', '1295f2cb-86d4-48be-aa21-a1deb2fafa7a', 'en', 'name', 'Orthodontic retainer plate');

-- ---- Staff <-> services ------------------------------------------------------
-- See the header comment above for the full rationale and the position-based
-- (not name-based) staff identification this relies on.

with ordered_staff as (
  select id, row_number() over (order by display_order, created_at) as rn
  from staff
  where is_active = true
),
all_service_ids(service_id) as (
  values
    ('48f9892e-90f8-4e18-b774-ecaeb51a42a8'::uuid),
    ('78e72016-0353-44f7-929e-ed3fe50c0cdb'::uuid),
    ('f9edd698-1e63-4a2f-bb0d-ff5bd8914e24'::uuid),
    ('a6960b8a-d8ac-47f7-ac93-d9aad3b1acd5'::uuid),
    ('d6eca1b5-0207-4d06-9b9e-31b7926a5366'::uuid),
    ('57f840bc-7d4a-43d3-9074-8822356287df'::uuid),
    ('052c78a8-0455-4435-bf9c-3a253374c20a'::uuid),
    ('c2d7f934-1ee7-4c55-81de-cc6933d444b8'::uuid),
    ('8256203a-7757-44a0-8db5-da87c86a4263'::uuid),
    ('7d13a019-7250-4501-ae9c-10ab01e46c65'::uuid),
    ('e0bb252c-9515-46c2-b717-9b70c8bc84f2'::uuid),
    ('0817398f-19d6-4397-a251-feb049cb3aae'::uuid),
    ('66d814ba-1088-4f25-bc56-9b58f21f9d75'::uuid),
    ('a5c0816f-fc7d-4910-8c6f-f04822069ace'::uuid),
    ('73063ba5-8490-45c0-b3cf-86e9bf100324'::uuid),
    ('5e88a248-e673-49ba-a9bf-e580c2b3b2fc'::uuid),
    ('b399c385-d30c-4e33-ba44-95c4ae9734ea'::uuid),
    ('1295f2cb-86d4-48be-aa21-a1deb2fafa7a'::uuid)
),
hygiene_service_ids(service_id) as (
  values
    ('a6960b8a-d8ac-47f7-ac93-d9aad3b1acd5'::uuid),
    ('d6eca1b5-0207-4d06-9b9e-31b7926a5366'::uuid),
    ('57f840bc-7d4a-43d3-9074-8822356287df'::uuid)
)
insert into staff_services (staff_id, service_id)
select s.id, v.service_id from ordered_staff s cross join all_service_ids v where s.rn = 1
union all
select s.id, v.service_id from ordered_staff s cross join hygiene_service_ids v where s.rn = 2;
