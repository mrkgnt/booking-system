import { describe, expect, it } from "vitest";
import { resolveSectionValues, splitIntoParagraphs, type SiteSectionSchema } from "./site-content";

// Pure-logic seams only (ADR-0005 / issue #22's testing decision): the
// read helper's network fetch is exercised live via this ticket's manual/
// E2E verification, not here. What's worth a vitest seam is the resolution
// rule itself — missing-locale fallback and localized:false field
// resolution — since that's genuine branching logic, not a network call.

const heroSchema: SiteSectionSchema = {
  pageSlug: "home",
  sectionKey: "hero",
  displayOrder: 1,
  fields: [
    { key: "headline", label: "Headline", type: "text", required: true, localized: true },
    { key: "cta_label", label: "CTA", type: "text", required: true, localized: true },
  ],
};

const quickContactSchema: SiteSectionSchema = {
  pageSlug: "home",
  sectionKey: "quick_contact",
  displayOrder: 7,
  fields: [{ key: "whatsapp_url", label: "WhatsApp", type: "text", required: false, localized: false }],
};

describe("resolveSectionValues", () => {
  it("uses the requested locale's value for a localized field when present", () => {
    const resolved = resolveSectionValues(
      heroSchema,
      {
        lv: { hero: { headline: "Vesels smaids.", cta_label: "Pieteikties" } },
        en: { hero: { headline: "Healthy smile.", cta_label: "Book now" } },
      },
      "en",
      "lv",
    );
    expect(resolved).toEqual({ headline: "Healthy smile.", cta_label: "Book now" });
  });

  it("falls back to the canonical locale when the requested locale has no content row at all", () => {
    const resolved = resolveSectionValues(
      heroSchema,
      {
        lv: { hero: { headline: "Vesels smaids.", cta_label: "Pieteikties" } },
        // no "ru" row yet — the Tenant hasn't translated this page.
      },
      "ru",
      "lv",
    );
    expect(resolved).toEqual({ headline: "Vesels smaids.", cta_label: "Pieteikties" });
  });

  it("falls back to the canonical locale when a requested-locale field is blank (partial translation)", () => {
    const resolved = resolveSectionValues(
      heroSchema,
      {
        lv: { hero: { headline: "Vesels smaids.", cta_label: "Pieteikties" } },
        en: { hero: { headline: "Healthy smile.", cta_label: "" } },
      },
      "en",
      "lv",
    );
    expect(resolved).toEqual({ headline: "Healthy smile.", cta_label: "Pieteikties" });
  });

  it("always reads a localized:false field from the canonical locale, even when the requested locale has its own content row", () => {
    const resolved = resolveSectionValues(
      quickContactSchema,
      {
        lv: { quick_contact: { whatsapp_url: "https://wa.me/37100000000" } },
        en: { quick_contact: { whatsapp_url: "https://en-should-be-ignored.example" } },
      },
      "en",
      "lv",
    );
    expect(resolved).toEqual({ whatsapp_url: "https://wa.me/37100000000" });
  });

  it("resolves to an empty string when a field is missing everywhere", () => {
    const resolved = resolveSectionValues(heroSchema, {}, "en", "lv");
    expect(resolved).toEqual({ headline: "", cta_label: "" });
  });
});

describe("splitIntoParagraphs", () => {
  it("splits on blank lines when the author used them", () => {
    const result = splitIntoParagraphs("First paragraph.\n\nSecond paragraph.\n\nThird.");
    expect(result).toEqual(["First paragraph.", "Second paragraph.", "Third."]);
  });

  it("falls back to splitting on single newlines when there are no blank lines", () => {
    const result = splitIntoParagraphs("First paragraph.\nSecond paragraph.");
    expect(result).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("returns an empty array for empty, undefined, or whitespace-only input", () => {
    expect(splitIntoParagraphs("")).toEqual([]);
    expect(splitIntoParagraphs(undefined)).toEqual([]);
    expect(splitIntoParagraphs("   \n  \n ")).toEqual([]);
  });

  it("drops stray blank entries and trims each paragraph", () => {
    const result = splitIntoParagraphs("  First.  \n\n\n  Second.  ");
    expect(result).toEqual(["First.", "Second."]);
  });
});
