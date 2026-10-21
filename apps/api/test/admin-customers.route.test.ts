import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /admin/customers — tenant and auth shape checks", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/admin/customers");
    expect(res.status).toBe(400);
  });

  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/customers", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(401);
  });
});

describe("GET /admin/customers/:id — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/customers/00000000-0000-0000-0000-000000000001", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /admin/customers/:id — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/customers/00000000-0000-0000-0000-000000000001", {
      method: "PATCH",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
