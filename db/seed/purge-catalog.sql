-- ============================================================================
-- Scoped catalog purge — removes ONLY the Faker-seeded catalog data
-- (service_categories/services/staff_services/their translations) plus the
-- bookings that reference those Faker services (every booking.service_id is
-- NOT NULL + FK-restricted to services(id), so it cannot be dropped without
-- first clearing whatever points at it).
--
-- Deliberately narrower than db/seed/purge.sql, which wipes ALL synthetic
-- dev data (customers, staff, business_hours, closures, etc. included).
-- Use THIS script instead of purge.sql when swapping in real catalog data
-- while real staff/business_hours/closures rows must be preserved — see
-- db/seed/dentdi-real-catalog.sql, which this is meant to run immediately
-- before.
--
-- Cascades handled automatically by existing FKs (see db/tenant-schema.sql):
--   - deleting bookings cascades to booking_verification_tokens and
--     notification_log (both `on delete cascade` on booking_id).
--   - deleting services cascades to staff_services (`on delete cascade` on
--     service_id).
-- audit_log.target_id has no FK (loose uuid), so nothing to cascade there.
--
-- Safe to re-run. Does NOT touch customers, staff, business_hours, closures,
-- tenant_integrations, external_busy_blocks, or staff_calendar_connections.
-- ============================================================================

delete from bookings;
delete from translations where entity_type in ('service', 'service_category');
delete from services;
delete from service_categories;
