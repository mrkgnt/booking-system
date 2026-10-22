import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

// Same convention as admin-business-hours.route.test.ts / admin-me.route.test.ts:
// only the pre-DB-call shape/auth/validation failures are provable without a
// live Supabase project with ticket #28's migration applied — the live Dent
// Di project doesn't have the site_sections/site_content tables yet (see
// CLAUDE.md's build-stage note for this ticket). The 200 happy path (actual
// section rows for a page) needs that migration live and is verified
// manually once it is, not here. The page-schema-driven business logic
// (required-field detection, localized-field routing) lives in
// src/lib/site-content.ts and is unit-tested directly in site-content.test.ts.

describe("GET /admin/site-sections — tenant and auth shape checks", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/admin/site-sections?page=home");
    expect(res.status).toBe(400);
  });

  it("404s for an unknown tenant slug", async () => {
    const res = await app.request("/admin/site-sections?page=home", {
      headers: { "X-Tenant-Slug": "nonexistent" },
    });
    expect(res.status).toBe(404);
  });

  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/site-sections?page=home", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("401s with a malformed Authorization header", async () => {
    const res = await app.request("/admin/site-sections?page=home", {
      headers: { "X-Tenant-Slug": "dentdi", Authorization: "Basic not-a-bearer-token" },
    });
    expect(res.status).toBe(401);
  });
});
