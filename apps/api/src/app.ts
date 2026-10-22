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
import { adminSiteSectionsRoute } from "./routes/admin-site-sections.js";
import { adminSiteContentRoute } from "./routes/admin-site-content.js";

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

// Shared helper for the wide-open (`origin: "*"`) CORS shape every public,
// unauthenticated widget-facing route below needs — the embedding/calling
// origin is an arbitrary third-party Tenant website or the shared
// apps/widget deployment, unknown in advance (see ADR-0004 / CLAUDE.md's
// "Booking Widget embedding mechanism" decision). `X-Tenant-Slug` is
// common to every one of these routes; callers add `Content-Type` only for
// the POST routes that send a JSON body.
function publicCors(methods: string[], extraHeaders: string[] = []) {
  return cors({
    origin: "*",
    allowHeaders: ["X-Tenant-Slug", ...extraHeaders],
    allowMethods: [...methods, "OPTIONS"],
  });
}

// Public, unauthenticated widget-facing routes under /public/*. Does NOT
// cover /availability or /bookings/* (the mutating booking-creation
// contract) — that's issue #14's scope, not this route's.
app.use("/public/*", publicCors(["GET"]));

// Issue #14: the Drawer's actual booking flow calls these three routes
// directly (not under /public/*) from the widget's iframe, whose origin is
// the widget's own deployed origin — still an arbitrary-in-advance origin
// from apps/api's perspective (one shared apps/widget deployment serves
// every Tenant's embed), so this needs the same wide-open CORS as
// /public/*. Scoped to exactly these three paths — NOT a blanket /admin/*
// change. /bookings/cancel and /bookings/reschedule get the same
// treatment further below, added by issues #16/#17 (the standalone,
// non-iframe cancel/reschedule pages) rather than here, since #14 never
// built those pages. /bookings and /bookings/confirm are POST with a
// JSON body, so they need Content-Type in allowHeaders in addition to
// X-Tenant-Slug.
app.use("/availability", publicCors(["GET"]));
app.use("/bookings", publicCors(["POST"], ["Content-Type"]));
app.use("/bookings/confirm", publicCors(["POST"], ["Content-Type"]));

// Issues #16/#17: the standalone (non-iframe) reschedule/cancel pages call
// these two directly from their own top-level page, same arbitrary-in-
// advance widget origin as above — deliberately excluded from #14's CORS
// scope above since #14 didn't build these pages.
app.use("/bookings/reschedule", publicCors(["POST"], ["Content-Type"]));
app.use("/bookings/cancel", publicCors(["POST"], ["Content-Type"]));

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
app.route("/", adminSiteSectionsRoute);
app.route("/", adminSiteContentRoute);
