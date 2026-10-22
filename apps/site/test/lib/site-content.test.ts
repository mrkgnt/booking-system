import { describe, expect, it } from "vitest";
import { getFieldValueByKey, getFirstFieldValueByType, parseImageUrls, parseLines } from "../../src/lib/site-content.js";
import type { SiteContentBundle } from "../../src/lib/site-content.js";

// Pure, DOM/network-free seams over an already-fetched Site Content bundle
// (issue #25/ADR-0005). The actual Supabase fetch is exercised live via the
// cross-app E2E suite (an admin edit showing up on the next apps/site page
// load), per issue #18's testing decisions — not unit-tested here.

describe("parseLines", () => {
  it("splits a textarea value into one trimmed item per non-empty line", () => {
    expect(parseLines("Free consultation\nModern equipment\n\nLV/RU/EN spoken  \n")).toEqual([
      "Free consultation",
      "Modern equipment",
      "LV/RU/EN spoken",
    ]);
  });

  it("returns an empty array for a blank/empty value", () => {
    expect(parseLines("")).toEqual([]);
    expect(parseLines("   \n  \n")).toEqual([]);
  });
});

describe("getFieldValueByKey", () => {
  const bundle: SiteContentBundle = {
    sections: {
      quick_contact: [
        { key: "whatsapp_url", label: "WhatsApp URL", type: "text", required: false, localized: false },
        { key: "telegram_url", label: "Telegram URL", type: "text", required: false, localized: false },
      ],
    },
    content: {
      quick_contact: { whatsapp_url: "https://wa.me/37100000000" },
    },
  };

  it("returns the trimmed value for a known section+field key", () => {
    expect(getFieldValueByKey(bundle, "quick_contact", "whatsapp_url")).toBe("https://wa.me/37100000000");
  });

  it("returns an empty string for a field that was never saved (blank, not a broken link)", () => {
    expect(getFieldValueByKey(bundle, "quick_contact", "telegram_url")).toBe("");
  });

  it("returns an empty string for an unknown section", () => {
    expect(getFieldValueByKey(bundle, "nope", "whatsapp_url")).toBe("");
  });
});

describe("getFirstFieldValueByType", () => {
  const bundle: SiteContentBundle = {
    sections: {
      value_props: [{ key: "items", label: "Value Props", type: "textarea", required: false, localized: true }],
    },
    content: {
      value_props: { items: "Free consultation\nModern equipment" },
    },
  };

  it("resolves the value by the field's declared type, not an assumed key name", () => {
    expect(getFirstFieldValueByType(bundle, "value_props", "textarea")).toBe(
      "Free consultation\nModern equipment",
    );
  });

  it("returns an empty string when no field of that type exists in the section", () => {
    expect(getFirstFieldValueByType(bundle, "value_props", "image")).toBe("");
  });

  it("returns an empty string for an unknown section", () => {
    expect(getFirstFieldValueByType(bundle, "nope", "textarea")).toBe("");
  });
});

// Pure seam — the gallery Site Content field (`home`/`gallery`/`image_urls`,
// ADR-0005, ticket #28) is stored as one newline-separated textarea value;
// this is the parser that turns it into a URL list, covered per ticket
// #23's explicit acceptance criterion.
describe("parseImageUrls", () => {
  it("splits a newline-separated string into trimmed URLs", () => {
    const raw = "https://example.com/a.jpg\nhttps://example.com/b.jpg\nhttps://example.com/c.jpg";
    expect(parseImageUrls(raw)).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
      "https://example.com/c.jpg",
    ]);
  });

  it("drops blank and whitespace-only lines", () => {
    const raw = "https://example.com/a.jpg\n\n   \nhttps://example.com/b.jpg\n";
    expect(parseImageUrls(raw)).toEqual(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
  });

  it("trims surrounding whitespace from each URL", () => {
    const raw = "  https://example.com/a.jpg  \n https://example.com/b.jpg";
    expect(parseImageUrls(raw)).toEqual(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseImageUrls("")).toEqual([]);
  });

  it("returns an empty array for null or undefined", () => {
    expect(parseImageUrls(null)).toEqual([]);
    expect(parseImageUrls(undefined)).toEqual([]);
  });

  it("returns an empty array for a string of only blank lines", () => {
    expect(parseImageUrls("\n   \n\n")).toEqual([]);
  });
});
