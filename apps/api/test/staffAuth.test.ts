import { describe, expect, it } from "vitest";
import { extractBearerToken } from "../src/middleware/staffAuth.js";

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("returns null when the header is missing", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null when the header doesn't start with 'Bearer '", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractBearerToken("")).toBeNull();
  });
});
