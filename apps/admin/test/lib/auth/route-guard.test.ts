import { describe, expect, it } from "vitest";
import { isPublicPath } from "../../../src/lib/auth/route-guard.js";

describe("isPublicPath", () => {
  it("treats /login and the auth API routes as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/logout")).toBe(true);
  });
  it("treats built assets and the favicon as public", () => {
    expect(isPublicPath("/_astro/index.abc123.js")).toBe(true);
    expect(isPublicPath("/favicon.svg")).toBe(true);
  });
  it("treats everything else as protected", () => {
    expect(isPublicPath("/bookings")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});
