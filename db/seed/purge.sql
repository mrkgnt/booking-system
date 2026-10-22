-- Purges all synthetic seed / dev data from a tenant project.
-- Leaves business_profile and roles (real config, not seed data) intact.
-- Safe to re-run; run before any real client data enters the project.
--
-- Also truncates `staff` — if real staff rows (e.g. Dent Di's two people)
-- must survive the purge, use db/seed/purge-catalog.sql instead, which
-- scopes to just the catalog tables + the bookings that reference them.

truncate table
  notification_log,
  audit_log,
  booking_verification_tokens,
  bookings,
  customers,
  staff_services,
  business_hours,
  closures,
  staff,
  services,
  translations,
  service_categories,
  external_busy_blocks,
  staff_calendar_connections,
  tenant_integrations
restart identity cascade;
