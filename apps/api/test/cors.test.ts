import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

describe("CORS on /admin/*", () => {
  it("reflects the configured admin origin on a preflight request", async () => {
    const res = await app.request("/admin/me", {
      method: "OPTIONS",
      headers: { Origin: env.ADMIN_APP_ORIGIN, "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(env.ADMIN_APP_ORIGIN);
  });

  it("does not add CORS headers for a disallowed origin", async () => {
    const res = await app.request("/admin/me", {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example.com", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

// Issue #14: the widget calls these three routes cross-origin from an
// arbitrary third-party Tenant site, so — unlike /admin/* above — they need
// wide-open CORS (origin: "*") regardless of what Origin is sent. Scoped to
// exactly these three paths, not a blanket change (see app.ts's comment);
// /bookings/cancel and /bookings/reschedule are deliberately NOT covered
// here — that's issues #16/#17's scope, not this one's.
describe("CORS on /availability, /bookings, /bookings/confirm (wide-open)", () => {
  it("/availability reflects * regardless of Origin, allows GET", async () => {
    const res = await app.request("/availability", {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example.com", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("/bookings reflects * regardless of Origin, allows POST + Content-Type/X-Tenant-Slug headers", async () => {
    const res = await app.request("/bookings", {
      method: "OPTIONS",
      headers: {
        Origin: "http://evil.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-Tenant-Slug",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain("Content-Type");
    expect(res.headers.get("access-control-allow-headers")).toContain("X-Tenant-Slug");
  });

  it("/bookings/confirm reflects * regardless of Origin, allows POST", async () => {
    const res = await app.request("/bookings/confirm", {
      method: "OPTIONS",
      headers: {
        Origin: "http://evil.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-Tenant-Slug",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("does NOT widen CORS on /bookings/cancel (out of scope for this ticket — #16/#17's)", async () => {
    const res = await app.request("/bookings/cancel", {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example.com", "Access-Control-Request-Method": "POST" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does NOT widen CORS on /bookings/reschedule (out of scope for this ticket — #16/#17's)", async () => {
    const res = await app.request("/bookings/reschedule", {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example.com", "Access-Control-Request-Method": "POST" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
