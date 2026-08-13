import { describe, expect, it } from "vitest";
import { generateRawToken, hashToken } from "../src/lib/tokens.js";

describe("tokens", () => {
  it("generates distinct tokens on each call", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
  });

  it("hashToken is deterministic for the same input", () => {
    const raw = "fixed-test-token";
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("hashToken produces different output for different input", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("hashToken never returns the raw input", () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).not.toBe(raw);
  });
});
