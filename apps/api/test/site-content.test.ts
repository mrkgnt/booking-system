import { describe, expect, it } from "vitest";
import {
  findMissingRequiredFields,
  mergeLocalizedContent,
  splitContentByLocalization,
  type SiteSectionRow,
} from "../src/lib/site-content.js";

// Mirrors db/tenant-schema.sql's site_sections.fields shape:
// { key, label, type, required, localized }.
const heroSection: SiteSectionRow = {
  section_key: "hero",
  fields: [
    { key: "headline", label: "Headline", type: "text", required: true, localized: true },
    { key: "subheadline", label: "Subheadline", type: "text", required: false, localized: true },
    { key: "photo_url", label: "Hero photo", type: "image", required: true, localized: false },
  ],
};

describe("findMissingRequiredFields", () => {
  it("returns an empty list when every required field has a non-empty value", () => {
    const missing = findMissingRequiredFields([heroSection], {
      hero: { headline: "Welcome", photo_url: "https://example.com/hero.jpg" },
    });
    expect(missing).toEqual([]);
  });

  it("flags a required field that's missing entirely", () => {
    const missing = findMissingRequiredFields([heroSection], {
      hero: { photo_url: "https://example.com/hero.jpg" },
    });
    expect(missing).toEqual(["hero.headline"]);
  });

  it("flags a required field whose value is an empty/whitespace-only string", () => {
    const missing = findMissingRequiredFields([heroSection], {
      hero: { headline: "   ", photo_url: "https://example.com/hero.jpg" },
    });
    expect(missing).toEqual(["hero.headline"]);
  });

  it("never flags a non-required field left empty", () => {
    const missing = findMissingRequiredFields([heroSection], {
      hero: { headline: "Welcome", subheadline: "", photo_url: "https://example.com/hero.jpg" },
    });
    expect(missing).toEqual([]);
  });

  it("flags every missing required field across multiple sections", () => {
    const aboutSection: SiteSectionRow = {
      section_key: "about",
      fields: [{ key: "body", label: "About body", type: "textarea", required: true, localized: true }],
    };
    const missing = findMissingRequiredFields([heroSection, aboutSection], { hero: {}, about: {} });
    expect(missing).toEqual(["hero.headline", "hero.photo_url", "about.body"]);
  });
});

describe("splitContentByLocalization", () => {
  it("routes localized fields to ownLocale and localized:false fields to canonical", () => {
    const { ownLocale, canonical } = splitContentByLocalization([heroSection], {
      hero: { headline: "Welcome", photo_url: "https://example.com/hero.jpg" },
    });
    expect(ownLocale).toEqual({ hero: { headline: "Welcome" } });
    expect(canonical).toEqual({ hero: { photo_url: "https://example.com/hero.jpg" } });
  });

  it("omits a field entirely from the split when it wasn't submitted", () => {
    const { ownLocale, canonical } = splitContentByLocalization([heroSection], {
      hero: { headline: "Welcome" },
    });
    expect(ownLocale).toEqual({ hero: { headline: "Welcome" } });
    expect(canonical).toEqual({});
  });
});

describe("mergeLocalizedContent", () => {
  it("lets ownLocale values override canonical values for the same field", () => {
    const merged = mergeLocalizedContent(
      { hero: { photo_url: "https://example.com/canonical.jpg", headline: "Canonical fallback" } },
      { hero: { headline: "Localized override" } },
    );
    expect(merged).toEqual({
      hero: { photo_url: "https://example.com/canonical.jpg", headline: "Localized override" },
    });
  });

  it("includes a section present only in canonical", () => {
    const merged = mergeLocalizedContent({ hero: { photo_url: "https://example.com/canonical.jpg" } }, {});
    expect(merged).toEqual({ hero: { photo_url: "https://example.com/canonical.jpg" } });
  });

  it("includes a section present only in ownLocale", () => {
    const merged = mergeLocalizedContent({}, { hero: { headline: "Welcome" } });
    expect(merged).toEqual({ hero: { headline: "Welcome" } });
  });
});
