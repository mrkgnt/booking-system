import { Hono } from "hono";
import { healthRoute } from "./routes/health.js";
import { smokeRoute } from "./routes/_smoke.js";
import { availabilityRoute } from "./routes/availability.js";
import { bookingsRoute } from "./routes/bookings.js";
import { adminMeRoute } from "./routes/admin-me.js";
import { adminBookingsRoute } from "./routes/admin-bookings.js";
import { adminPatientsRoute } from "./routes/admin-patients.js";
import { adminServiceCategoriesRoute } from "./routes/admin-service-categories.js";
import { adminServicesRoute } from "./routes/admin-services.js";
import { adminStaffRoute } from "./routes/admin-staff.js";
import { adminBusinessHoursRoute } from "./routes/admin-business-hours.js";
import { adminClosuresRoute } from "./routes/admin-closures.js";

// Runtime-agnostic — no @hono/node-server, no wrangler/Vercel-specific code
// here. Local dev wraps this in src/index.ts; a Workers/Vercel entry later
// would be a small additive file using app.fetch, not a rewrite of this.
export const app = new Hono();

app.route("/", healthRoute);
app.route("/", smokeRoute);
app.route("/", availabilityRoute);
app.route("/", bookingsRoute);
app.route("/", adminMeRoute);
app.route("/", adminBookingsRoute);
app.route("/", adminPatientsRoute);
app.route("/", adminServiceCategoriesRoute);
app.route("/", adminServicesRoute);
app.route("/", adminStaffRoute);
app.route("/", adminBusinessHoursRoute);
app.route("/", adminClosuresRoute);
