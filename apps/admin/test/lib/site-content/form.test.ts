import { describe, expect, it } from "vitest";
import { buildRenderedFields, findMissingRequiredFields } from "../../../src/lib/site-content/form.js";
import type { SiteSection } from "../../../src/lib/api/site-content.js";

const sections: SiteSection[] = [
  {
    id: "s2",
    page_slug: "home",
    section_key: "about",
    display_order: 2,
    fields: [{ key: "heading", label: "Heading", type: "text", required: true, localized: true }],
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "s1",
    page_slug: "home",
    section_key: "hero",
    display_order: 1,
    fields: [
      { key: "headline", label: "Headline", type: "text", required: true, localized: true },
      { key: "subhead", label: "Subheadline", type: "textarea", required: true, localized: true },
      { key: "logo_url", label: "Logo", type: "image", required: false, localized: false },
    ],
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("buildRenderedFields", () => {
  it("maps each field's declared type to the right input kind and pulls its value", () => {
    const content = {
      hero: { headline: "Vesels smaids.", subhead: "", logo_url: "https://example.com/logo.png" },
      about: { heading: "Par Dent Di" },
    };
    expect(buildRenderedFields(sections, content)).toEqual([
      { sectionKey: "hero", fieldKey: "headline", label: "Headline", inputType: "text", value: "Vesels smaids.", required: true, localized: true },
      { sectionKey: "hero", fieldKey: "subhead", label: "Subheadline", inputType: "textarea", value: "", required: true, localized: true },
      { sectionKey: "hero", fieldKey: "logo_url", label: "Logo", inputType: "image", value: "https://example.com/logo.png", required: false, localized: false },
      { sectionKey: "about", fieldKey: "heading", label: "Heading", inputType: "text", value: "Par Dent Di", required: true, localized: true },
    ]);
  });

  it("orders sections by display_order regardless of input array order", () => {
    const rows = buildRenderedFields(sections, {});
    expect(rows.map((r) => r.sectionKey)).toEqual(["hero", "hero", "hero", "about"]);
  });

  it("defaults a missing field value to an empty string", () => {
    const rows = buildRenderedFields(sections, {});
    expect(rows.every((r) => r.value === "")).toBe(true);
  });
});

describe("findMissingRequiredFields", () => {
  it("returns required fields that are blank or missing", () => {
    const content = { hero: { headline: "", subhead: "  " }, about: { heading: "Par Dent Di" } };
    const missing = findMissingRequiredFields(buildRenderedFields(sections, content));
    expect(missing.map((f) => `${f.sectionKey}.${f.fieldKey}`)).toEqual(["hero.headline", "hero.subhead"]);
  });

  it("returns an empty array when every required field is filled", () => {
    const content = { hero: { headline: "Vesels smaids.", subhead: "Rupiga diagnostika." }, about: { heading: "Par Dent Di" } };
    expect(findMissingRequiredFields(buildRenderedFields(sections, content))).toEqual([]);
  });

  it("never flags a non-required field as missing", () => {
    const missing = findMissingRequiredFields(buildRenderedFields(sections, {}));
    expect(missing.some((f) => f.fieldKey === "logo_url")).toBe(false);
  });
});
