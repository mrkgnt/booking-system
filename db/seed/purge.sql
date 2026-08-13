-- Purges all synthetic seed / dev data from a tenant project.
-- Leaves business_profile and roles (real config, not seed data) intact.
-- Safe to re-run; run before any real client data enters the project.

truncate table
  notification_log,
  audit_log,
  booking_verification_tokens,
  bookings,
  patients,
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
