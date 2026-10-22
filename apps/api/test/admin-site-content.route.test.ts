import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

// Same convention as admin-business-hours.route.test.ts / admin-me.route.test.ts:
// only the pre-DB-call shape/auth failures are provable without a live
// Supabase project with ticket #28's migration applied — the live Dent Di
// project doesn't have the site_sections/site_content tables yet (see
// CLAUDE.md's build-stage note for this ticket). The 200 happy path and the
// missing-required-field rejection both depend on reading the live
// site_sections schema first, so they need that migration live and are
// verified manually once it is, not here. The actual required-field/
// localized-field business logic they'd exercise is already unit-tested
// directly, without a DB, in site-content.test.ts
// (findMissingRequiredFields/splitContentByLocalization/mergeLocalizedContent).

describe("GET /admin/site-content — tenant and auth shape checks", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/admin/site-content?page=home&locale=en");
    expect(res.status).toBe(400);
  });

  it("404s for an unknown tenant slug", async () => {
    const res = await app.request("/admin/site-content?page=home&locale=en", {
      headers: { "X-Tenant-Slug": "nonexistent" },
    });
    expect(res.status).toBe(404);
  });

  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/site-content?page=home&locale=en", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("401s with a malformed Authorization header", async () => {
    const res = await app.request("/admin/site-content?page=home&locale=en", {
      headers: { "X-Tenant-Slug": "dentdi", Authorization: "Basic not-a-bearer-token" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PUT /admin/site-content — tenant and auth shape checks", () => {
  it("401s with no Authorization header", async () => {
    const res = await app.request("/admin/site-content", {
      method: "PUT",
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: JSON.stringify({ page: "home", locale: "en", content: {} }),
    });
    expect(res.status).toBe(401);
  });
});
