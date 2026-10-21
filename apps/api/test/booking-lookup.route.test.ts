import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { resetRateLimitBuckets } from "../src/middleware/rate-limit.js";

// These cover the request-shape/validation/tenant-resolution/CORS layer,
// which runs (and can fail) before any Supabase call — mirroring
// bookings.route.test.ts's documented split. A real confirmed booking +
// issued capability token against the live dentdi project is verified
// manually, not here, per the same existing precedent.

describe("GET /public/bookings/lookup — validation and tenant resolution", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/public/bookings/lookup?token=some-token-value");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "X-Tenant-Slug header is required" });
  });

  it("404s for an unknown tenant slug", async () => {
    const res = await app.request("/public/bookings/lookup?token=some-token-value", {
      headers: { "X-Tenant-Slug": "nonexistent" },
    });
    expect(res.status).toBe(404);
  });

  it("400s on a missing token query param", async () => {
    const res = await app.request("/public/bookings/lookup", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("400s on a too-short token", async () => {
    const res = await app.request("/public/bookings/lookup?token=short", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("400s with invalid_or_expired_token for a well-formed token that doesn't exist", async () => {
    const res = await app.request("/public/bookings/lookup?token=a-valid-length-token-that-does-not-exist", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_or_expired_token" });
  });

  it("400s on an invalid locale query param", async () => {
    const res = await app.request("/public/bookings/lookup?token=a-valid-length-token-value&locale=xx", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });
});

describe("CORS on /public/*", () => {
  it("reflects a wide-open origin on a preflight request, regardless of the Origin sent", async () => {
    const res = await app.request("/public/bookings/lookup", {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example.com", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
