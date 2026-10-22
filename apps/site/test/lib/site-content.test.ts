import { describe, expect, it } from "vitest";
import { parseImageUrls } from "../../src/lib/site-content.js";

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
