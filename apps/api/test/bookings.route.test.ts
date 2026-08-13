import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { resetRateLimitBuckets } from "../src/middleware/rate-limit.js";

// These cover the request-shape/validation/tenant-resolution layer, which
// runs (and can fail) before any Supabase call — so they're provable
// without a live DB or mocking the Supabase client. The full happy-path
// insert flow needs a real service-role key against the live project (see
// CLAUDE.md) and is verified manually via curl, not here.

describe("POST /bookings — validation and tenant resolution", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/bookings", { method: "POST", body: "{}" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "X-Tenant-Slug header is required" });
  });

  it("404s for an unknown tenant slug", async () => {
    const res = await app.request("/bookings", {
      method: "POST",
      headers: { "X-Tenant-Slug": "nonexistent", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  it("400s on an empty body (fails zod validation before any DB call)", async () => {
    const res = await app.request("/bookings", {
      method: "POST",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("400s when consentGiven is missing", async () => {
    const res = await app.request("/bookings", {
      method: "POST",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: "00000000-0000-0000-0000-000000000001",
        startsAt: "2027-03-01T10:00:00.000Z",
        locale: "en",
        patient: { name: "Test Patient", email: "test@example.com" },
        idempotencyKey: "test-idempotency-key-1",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("400s when neither email nor phone is supplied", async () => {
    const res = await app.request("/bookings", {
      method: "POST",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: "00000000-0000-0000-0000-000000000001",
        startsAt: "2027-03-01T10:00:00.000Z",
        locale: "en",
        patient: { name: "Test Patient" },
        consentGiven: true,
        idempotencyKey: "test-idempotency-key-2",
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /availability — validation and tenant resolution", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/availability?service_id=00000000-0000-0000-0000-000000000001&date=2027-03-01");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "X-Tenant-Slug header is required" });
  });

  it("400s on a malformed date", async () => {
    const res = await app.request(
      "/availability?service_id=00000000-0000-0000-0000-000000000001&date=not-a-date",
      { headers: { "X-Tenant-Slug": "dentdi" } },
    );
    expect(res.status).toBe(400);
  });

  it("400s on a non-uuid service_id", async () => {
    const res = await app.request("/availability?service_id=not-a-uuid&date=2027-03-01", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /bookings/confirm — validation and tenant resolution", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/bookings/confirm", { method: "POST", body: "{}" });
    expect(res.status).toBe(400);
  });

  it("400s on a missing token", async () => {
    const res = await app.request("/bookings/confirm", {
      method: "POST",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });
});
