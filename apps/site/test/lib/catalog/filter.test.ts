import { describe, expect, it } from "vitest";
import { filterServices, type CatalogService } from "../../../src/lib/catalog/filter.js";

// Deliberately generic fixture names — the real catalog may still hold
// Faker placeholder data or real Dent Di data depending on when this
// lands relative to ticket #26, and this logic must be correct either
// way (issue #24).
const services: CatalogService[] = [
  { id: "1", categoryId: "cat-consult", name: "Initial Consultation" },
  { id: "2", categoryId: "cat-consult", name: "Follow-up Consultation" },
  { id: "3", categoryId: "cat-hygiene", name: "Full Mouth Hygiene" },
  { id: "4", categoryId: "cat-hygiene", name: "Teeth Polishing" },
  { id: "5", categoryId: "cat-surgery", name: "Tooth Extraction" },
];

describe("filterServices", () => {
  it("returns every service when no category or search filter is given", () => {
    expect(filterServices(services, {})).toEqual(services);
  });

  it("narrows to one category when a categoryId is given", () => {
    const result = filterServices(services, { categoryId: "cat-hygiene" });
    expect(result.map((s) => s.id)).toEqual(["3", "4"]);
  });

  it("filters by service name search, case-insensitively", () => {
    const result = filterServices(services, { search: "consultation" });
    expect(result.map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("matches a search term appearing anywhere in the name, not just a prefix", () => {
    const result = filterServices(services, { search: "tooth" });
    expect(result.map((s) => s.id)).toEqual(["5"]);
  });

  it("combines category and search filters", () => {
    const result = filterServices(services, { categoryId: "cat-hygiene", search: "polish" });
    expect(result.map((s) => s.id)).toEqual(["4"]);
  });

  it("returns an empty list when the combined filters match nothing", () => {
    const result = filterServices(services, { categoryId: "cat-consult", search: "polish" });
    expect(result).toEqual([]);
  });

  it("ignores leading/trailing whitespace in the search term", () => {
    const result = filterServices(services, { search: "  extraction  " });
    expect(result.map((s) => s.id)).toEqual(["5"]);
  });

  it("treats an empty-string search as no search filter", () => {
    const result = filterServices(services, { search: "" });
    expect(result).toEqual(services);
  });

  it("treats a null categoryId the same as no category filter", () => {
    const result = filterServices(services, { categoryId: null });
    expect(result).toEqual(services);
  });
});
