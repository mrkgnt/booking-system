import { describe, expect, it } from "vitest";
import { buildTenantInfoUrl } from "../../../src/lib/api/tenant-info.js";

describe("buildTenantInfoUrl", () => {
  it("builds the GET /public/tenant-info URL against the given API base", () => {
    expect(buildTenantInfoUrl("http://localhost:8787")).toBe("http://localhost:8787/public/tenant-info");
  });

  it("appends a locale query param when a locale is given", () => {
    expect(buildTenantInfoUrl("http://localhost:8787", "ru")).toBe(
      "http://localhost:8787/public/tenant-info?locale=ru",
    );
  });

  it("strips a trailing slash on the API base URL", () => {
    expect(buildTenantInfoUrl("http://localhost:8787/")).toBe("http://localhost:8787/public/tenant-info");
  });
});
