import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

// Read-only live check (not a mutation) deciding whether the happy-path
// block below can run meaningfully — see the final report for this ticket:
// dentdi's live business_profile.status is currently "onboarding" (the
// schema default, never flipped to "active" post go-live, a pre-existing
// data gap unrelated to this route). The new tenant_inactive gate correctly
// treats that as inactive, so a real happy-path response isn't obtainable
// against the live project until a human flips that status via the
// Supabase dashboard (same confirmation-gate pattern as other destructive
// ops documented in CLAUDE.md). This block activates itself automatically
// the moment that's corrected, rather than needing a code change here.
const liveSupabase = createClient(env.DENTDI_SUPABASE_URL, env.DENTDI_SUPABASE_SECRET_KEY);
const { data: liveBusinessProfile } = await liveSupabase.from("business_profile").select("status").single();
const dentdiIsActive = liveBusinessProfile?.status === "active";

describe("GET /public/tenant-info — validation and tenant resolution", () => {
  it("400s with no X-Tenant-Slug header", async () => {
    const res = await app.request("/public/tenant-info");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "X-Tenant-Slug header is required" });
  });

  it("404s for an unknown tenant slug", async () => {
    const res = await app.request("/public/tenant-info", {
      headers: { "X-Tenant-Slug": "nonexistent" },
    });
    expect(res.status).toBe(404);
  });

  // dentdi's live business_profile.status is currently "onboarding" (the
  // schema default — never flipped to "active" post go-live, see the final
  // report for this ticket), which this test exercises directly against
  // the real project rather than needing a second fixture tenant.
  it("404s with a clear error body for a tenant whose business_profile.status isn't active", async () => {
    const res = await app.request("/public/tenant-info", {
      headers: { "X-Tenant-Slug": "dentdi" },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "tenant_inactive" });
  });
});

describe("CORS on /public/tenant-info", () => {
  it("allows any origin (wide-open, not reflected-and-restricted like /admin/*)", async () => {
    const res = await app.request("/public/tenant-info", {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example.com", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

// Seeded fixture ids with known lv/ru/en-prefixed translations
// ("[LV] ...", "[RU] ...", "[EN] ..." — see db/seed/generate-seed.ts).
// Looked up by id rather than array index: the live dentdi project also
// carries leftover rows from other test suites' E2E runs (many sharing
// display_order: 0, per CLAUDE.md's documented E2E-flakiness history), so
// body.services[0] isn't a stable reference to a particular seeded row.
const SEEDED_SERVICE_ID = "8831eea5-5bee-4ca1-a2e9-01a028ba3b35";
const SEEDED_CATEGORY_ID = "5fb9220d-9b0f-4d32-a248-6492457c3890";

describe.skipIf(!dentdiIsActive)("GET /public/tenant-info — happy path (live dentdi project)", () => {
  it("returns tenant info and catalog shaped per the widget contract, resolved to the default locale", async () => {
    const res = await app.request("/public/tenant-info", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.tenant).toEqual({
      name: "Dent Di",
      themeTokens: expect.any(Object),
      defaultLocale: "lv",
      supportedLocales: ["lv", "ru", "en"],
    });

    expect(Array.isArray(body.serviceCategories)).toBe(true);
    expect(body.serviceCategories.length).toBeGreaterThan(0);
    for (const category of body.serviceCategories) {
      expect(typeof category.name).toBe("string"); // always resolved to a plain string, even for untranslated leftover rows (falls back to "")
    }
    const seededCategory = body.serviceCategories.find((c: { id: string }) => c.id === SEEDED_CATEGORY_ID);
    expect(seededCategory.name.startsWith("[LV]")).toBe(true); // default_locale is "lv", no ?locale= given

    expect(Array.isArray(body.services)).toBe(true);
    expect(body.services.length).toBeGreaterThan(0);
    for (const service of body.services) {
      expect(typeof service.name).toBe("string");
      expect(typeof service.durationMinutes).toBe("number");
    }
    const seededService = body.services.find((s: { id: string }) => s.id === SEEDED_SERVICE_ID);
    expect(seededService.name.startsWith("[LV]")).toBe(true);

    expect(Array.isArray(body.staff)).toBe(true);
    expect(body.staff.length).toBeGreaterThan(0);
    for (const member of body.staff) {
      expect(typeof member.name).toBe("string"); // plain column, no locale resolution needed
    }

    expect(Array.isArray(body.staffServices)).toBe(true);
    expect(body.staffServices.length).toBeGreaterThan(0);
    for (const link of body.staffServices) {
      expect(typeof link.staffId).toBe("string");
      expect(typeof link.serviceId).toBe("string");
    }
  });

  it("resolves names to the requested ?locale= instead of the default", async () => {
    const res = await app.request("/public/tenant-info?locale=ru", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const seededService = body.services.find((s: { id: string }) => s.id === SEEDED_SERVICE_ID);
    const seededCategory = body.serviceCategories.find((c: { id: string }) => c.id === SEEDED_CATEGORY_ID);
    expect(seededService.name.startsWith("[RU]")).toBe(true);
    expect(seededCategory.name.startsWith("[RU]")).toBe(true);
  });

  it("falls back to default_locale when the requested locale has no translation", async () => {
    const res = await app.request("/public/tenant-info?locale=fr", { headers: { "X-Tenant-Slug": "dentdi" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const seededService = body.services.find((s: { id: string }) => s.id === SEEDED_SERVICE_ID);
    expect(seededService.name.startsWith("[LV]")).toBe(true);
  });
});
