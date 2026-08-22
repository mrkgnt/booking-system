import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /admin/bookings — tenant, auth, and validation shape checks", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/admin/bookings");
    expect(res.status).toBe(400);
  });

  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/bookings", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(401);
  });
});
