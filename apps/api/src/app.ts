import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env.js";
import { healthRoute } from "./routes/health.js";
import { smokeRoute } from "./routes/_smoke.js";
import { availabilityRoute } from "./routes/availability.js";
import { bookingsRoute } from "./routes/bookings.js";
import { tenantInfoRoute } from "./routes/tenant-info.js";
import { bookingLookupRoute } from "./routes/booking-lookup.js";
import { adminMeRoute } from "./routes/admin-me.js";
import { adminBookingsRoute } from "./routes/admin-bookings.js";
import { adminCustomersRoute } from "./routes/admin-customers.js";
import { adminServiceCategoriesRoute } from "./routes/admin-service-categories.js";
import { adminServicesRoute } from "./routes/admin-services.js";
import { adminStaffRoute } from "./routes/admin-staff.js";
import { adminBusinessHoursRoute } from "./routes/admin-business-hours.js";
import { adminClosuresRoute } from "./routes/admin-closures.js";

// Runtime-agnostic — no @hono/node-server, no wrangler/Vercel-specific code
// here. Local dev wraps this in src/index.ts; a Workers/Vercel entry later
// would be a small additive file using app.fetch, not a rewrite of this.
export const app = new Hono();

app.use(
  "/admin/*",
  cors({
    origin: env.ADMIN_APP_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization", "X-Tenant-Slug"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);

// Wide-open CORS for public, unauthenticated widget-facing routes under
// /public/* — the embedding origin is an arbitrary third-party Tenant
// website, unknown in advance (see ADR-0004 / CLAUDE.md's "Booking Widget
// embedding mechanism" decision). Does NOT cover /availability or
// /bookings/* (the mutating booking-creation contract) — that's issue
// #14's scope, not this route's.
app.use(
  "/public/*",
  cors({
    origin: "*",
    allowHeaders: ["X-Tenant-Slug"],
    allowMethods: ["GET", "OPTIONS"],
  }),
);

app.route("/", healthRoute);
app.route("/", smokeRoute);
app.route("/", availabilityRoute);
app.route("/", bookingsRoute);
app.route("/", tenantInfoRoute);
app.route("/", bookingLookupRoute);
app.route("/", adminMeRoute);
app.route("/", adminBookingsRoute);
app.route("/", adminCustomersRoute);
app.route("/", adminServiceCategoriesRoute);
app.route("/", adminServicesRoute);
app.route("/", adminStaffRoute);
app.route("/", adminBusinessHoursRoute);
app.route("/", adminClosuresRoute);
