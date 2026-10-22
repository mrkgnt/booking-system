import { describe, expect, it } from "vitest";
import { buildMapsUrl, buildWazeUrl } from "../../src/lib/find-us.js";

// Pure URL builders for the "find us" band (issue #25) — built at render
// time from the Tenant's existing business_profile.address, never a
// separately-entered Site Content field, so there's no way for a manually
// entered link to drift from the real address (see issue #18's "find us"
// decision).
describe("buildMapsUrl", () => {
  it("builds a Google Maps search URL from an address", () => {
    expect(buildMapsUrl("Zirņu iela 8-60, Rīga")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Zir%C5%86u%20iela%208-60%2C%20R%C4%ABga",
    );
  });

  it("URL-encodes special characters in the address", () => {
    expect(buildMapsUrl("A & B / C")).toBe(
      "https://www.google.com/maps/search/?api=1&query=A%20%26%20B%20%2F%20C",
    );
  });
});

describe("buildWazeUrl", () => {
  it("builds a Waze navigation URL from an address", () => {
    expect(buildWazeUrl("Zirņu iela 8-60, Rīga")).toBe(
      "https://waze.com/ul?q=Zir%C5%86u%20iela%208-60%2C%20R%C4%ABga",
    );
  });
});
