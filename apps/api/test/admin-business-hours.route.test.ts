import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /admin/business-hours — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/business-hours", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(401);
  });
});

describe("PUT /admin/business-hours — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/business-hours", {
      method: "PUT",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
