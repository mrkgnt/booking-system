// Generates db/seed.sql — deterministic synthetic seed data for local/dev
// testing of the tenant schema (db/tenant-schema.sql). Run with:
//   npm run seed:generate
//
// Output is plain SQL, applied directly against a project's SQL editor /
// migration tool / the Supabase MCP execute_sql tool — this script has no
// network access to Supabase itself, it only produces the SQL text.
//
// Purely synthetic data (faker, fixed seed for reproducibility). Per the
// working agreement (CLAUDE.md), this must be purged before real client
// data or a real release — see db/seed/purge.sql.

import { faker } from "@faker-js/faker";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

faker.seed(42);

const LOCALES = ["lv", "ru", "en"] as const;
type Locale = (typeof LOCALES)[number];

function esc(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlBool(value: boolean): string {
  return value ? "true" : "false";
}

function sqlArrayText(values: string[]): string {
  return `array[${values.map((v) => esc(v)).join(", ")}]`;
}

type Category = { id: string; icon: string; displayOrder: number };
type Service = {
  id: string;
  categoryId: string;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  priceAmount: number;
  pricePrefix: "exact" | "from" | "up_to";
  displayOrder: number;
};
type Staff = { id: string; name: string; isBookable: boolean; displayOrder: number };
type Patient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferredLocale: Locale;
};
type Booking = {
  id: string;
  patientId: string;
  serviceId: string;
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  locale: Locale;
  status: "pending_verification" | "confirmed" | "completed" | "cancelled" | "no_show";
  source: "public" | "admin_manual";
  idempotencyKey: string;
};

const CATEGORY_DEFS = [
  { icon: "tooth", label: "General Dentistry" },
  { icon: "sparkles", label: "Cosmetic Dentistry" },
  { icon: "braces", label: "Orthodontics" },
  { icon: "scalpel", label: "Oral Surgery" },
  { icon: "child", label: "Pediatric Dentistry" },
  { icon: "shield", label: "Preventive Care" },
] as const;

const categories: Category[] = CATEGORY_DEFS.map((def, i) => ({
  id: faker.string.uuid(),
  icon: def.icon,
  displayOrder: i,
}));

const services: Service[] = [];
for (const category of categories) {
  const count = faker.number.int({ min: 5, max: 7 });
  for (let i = 0; i < count; i++) {
    services.push({
      id: faker.string.uuid(),
      categoryId: category.id,
      durationMinutes: faker.helpers.arrayElement([15, 20, 30, 45, 60, 90]),
      bufferBefore: faker.helpers.arrayElement([0, 0, 5, 10]),
      bufferAfter: faker.helpers.arrayElement([0, 5, 10, 15]),
      priceAmount: faker.number.float({ min: 15, max: 850, fractionDigits: 2 }),
      pricePrefix: faker.helpers.arrayElement(["exact", "exact", "exact", "from"]),
      displayOrder: i,
    });
  }
}

const staff: Staff[] = [
  { id: faker.string.uuid(), name: faker.person.fullName(), isBookable: true, displayOrder: 0 },
  { id: faker.string.uuid(), name: faker.person.fullName(), isBookable: true, displayOrder: 1 },
];
const [dentist, nurse] = staff;

const patients: Patient[] = Array.from({ length: 18 }, () => {
  const locale = faker.helpers.arrayElement(LOCALES);
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number({ style: "international" }),
    preferredLocale: locale,
  };
});

const bookings: Booking[] = [];
const now = new Date("2026-08-13T09:00:00Z");
for (let i = 0; i < 28; i++) {
  const patient = faker.helpers.arrayElement(patients);
  const service = faker.helpers.arrayElement(services);
  const bookedStaff = faker.helpers.arrayElement(
    service.durationMinutes <= 30 ? staff : [dentist],
  );
  const daysOffset = faker.number.int({ min: -60, max: 45 });
  const startsAt = new Date(now);
  startsAt.setUTCDate(startsAt.getUTCDate() + daysOffset);
  startsAt.setUTCHours(faker.number.int({ min: 8, max: 16 }), faker.helpers.arrayElement([0, 30]), 0, 0);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  const isPast = startsAt < now;
  const status: Booking["status"] = isPast
    ? faker.helpers.arrayElement(["completed", "completed", "completed", "cancelled", "no_show"])
    : faker.helpers.arrayElement(["confirmed", "confirmed", "pending_verification"]);

  bookings.push({
    id: faker.string.uuid(),
    patientId: patient.id,
    serviceId: service.id,
    staffId: bookedStaff.id,
    startsAt,
    endsAt,
    locale: patient.preferredLocale,
    status,
    source: faker.helpers.arrayElement(["public", "public", "public", "admin_manual"]),
    idempotencyKey: faker.string.uuid(),
  });
}

// ---- SQL generation ----

const lines: string[] = [];
lines.push("-- ============================================================================");
lines.push("-- Synthetic seed data — GENERATED by db/seed/generate-seed.ts, do not hand-edit.");
lines.push("-- Regenerate with `npm run seed:generate`. Purely synthetic (faker, seed 42).");
lines.push("-- Purge before real client data / real release — see db/seed/purge.sql.");
lines.push("-- ============================================================================");
lines.push("");

lines.push("-- Service categories");
for (const c of categories) {
  lines.push(
    `insert into service_categories (id, icon, display_order) values (${esc(c.id)}, ${esc(c.icon)}, ${c.displayOrder});`,
  );
}
lines.push("");

lines.push("-- Category translations (name only — descriptions omitted for seed brevity)");
for (const [i, c] of categories.entries()) {
  const label = CATEGORY_DEFS[i].label;
  for (const locale of LOCALES) {
    lines.push(
      `insert into translations (entity_type, entity_id, locale, field, value) values ('service_category', ${esc(c.id)}, ${esc(locale)}, 'name', ${esc(`[${locale.toUpperCase()}] ${label}`)});`,
    );
  }
}
lines.push("");

lines.push("-- Services");
for (const s of services) {
  lines.push(
    `insert into services (id, category_id, duration_minutes, buffer_minutes_before, buffer_minutes_after, price_amount, price_prefix, display_order) values (${esc(s.id)}, ${esc(s.categoryId)}, ${s.durationMinutes}, ${s.bufferBefore}, ${s.bufferAfter}, ${s.priceAmount}, ${esc(s.pricePrefix)}, ${s.displayOrder});`,
  );
}
lines.push("");

lines.push("-- Service translations (name only)");
for (const s of services) {
  const name = faker.commerce.productName();
  for (const locale of LOCALES) {
    lines.push(
      `insert into translations (entity_type, entity_id, locale, field, value) values ('service', ${esc(s.id)}, ${esc(locale)}, 'name', ${esc(`[${locale.toUpperCase()}] ${name}`)});`,
    );
  }
}
lines.push("");

lines.push("-- Staff");
for (const s of staff) {
  lines.push(
    `insert into staff (id, name, display_order, is_bookable) values (${esc(s.id)}, ${esc(s.name)}, ${s.displayOrder}, ${sqlBool(s.isBookable)});`,
  );
}
lines.push("");

lines.push("-- Staff <-> services (dentist does everything, nurse does short/preventive services)");
for (const s of services) {
  lines.push(`insert into staff_services (staff_id, service_id) values (${esc(dentist.id)}, ${esc(s.id)});`);
  if (s.durationMinutes <= 30) {
    lines.push(`insert into staff_services (staff_id, service_id) values (${esc(nurse.id)}, ${esc(s.id)});`);
  }
}
lines.push("");

lines.push("-- Business hours (business-wide default: Mon-Fri 9-18, Sat/Sun closed)");
for (let day = 0; day <= 6; day++) {
  const isWeekend = day === 0 || day === 6;
  lines.push(
    `insert into business_hours (staff_id, day_of_week, opens_at, closes_at, is_closed) values (null, ${day}, ${isWeekend ? "null" : "'09:00'"}, ${isWeekend ? "null" : "'18:00'"}, ${sqlBool(isWeekend)});`,
  );
}
lines.push("");

lines.push("-- Patients");
for (const p of patients) {
  lines.push(
    `insert into patients (id, name, email, phone, preferred_locale, consent_given_at) values (${esc(p.id)}, ${esc(p.name)}, ${esc(p.email)}, ${esc(p.phone)}, ${esc(p.preferredLocale)}, now());`,
  );
}
lines.push("");

lines.push("-- Bookings");
for (const b of bookings) {
  lines.push(
    `insert into bookings (id, patient_id, service_id, staff_id, starts_at, ends_at, locale, status, source, idempotency_key, consent_given_at) values (${esc(b.id)}, ${esc(b.patientId)}, ${esc(b.serviceId)}, ${esc(b.staffId)}, ${esc(b.startsAt.toISOString())}, ${esc(b.endsAt.toISOString())}, ${esc(b.locale)}, ${esc(b.status)}, ${esc(b.source)}, ${esc(b.idempotencyKey)}, now());`,
  );
}
lines.push("");

lines.push("-- Notification log for a sample of bookings (delivery tracking)");
for (const b of bookings.slice(0, 12)) {
  const channel = faker.helpers.arrayElement(["email", "sms"]);
  const template =
    b.status === "cancelled"
      ? "cancellation"
      : b.status === "pending_verification"
        ? "double_opt_in"
        : "confirmation";
  lines.push(
    `insert into notification_log (booking_id, channel, template, locale, status) values (${esc(b.id)}, ${esc(channel)}, ${esc(template)}, ${esc(b.locale)}, 'sent');`,
  );
}
lines.push("");

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../seed.sql");
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Wrote ${outPath}`);
console.log(
  `${categories.length} categories, ${services.length} services, ${staff.length} staff, ${patients.length} patients, ${bookings.length} bookings`,
);
