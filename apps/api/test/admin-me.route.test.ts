import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

// Same convention as bookings.route.test.ts: only the pre-DB-call
// shape/auth failures are provable without a live Supabase project. The
// 200 happy path is verified live in this task's Step 6.

describe("GET /admin/me — tenant and auth shape checks", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/admin/me");
    expect(res.status).toBe(400);
  });

  it("404s for an unknown tenant slug", async () => {
    const res = await app.request("/admin/me", { headers: { "X-Tenant-Slug": "nonexistent" } });
    expect(res.status).toBe(404);
  });

  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/me", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("401s with a malformed Authorization header", async () => {
    const res = await app.request("/admin/me", {
      headers: { "X-Tenant-Slug": "dentdi", Authorization: "Basic not-a-bearer-token" },
    });
    expect(res.status).toBe(401);
  });
});
