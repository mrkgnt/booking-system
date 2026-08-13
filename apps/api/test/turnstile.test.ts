import { describe, expect, it, vi } from "vitest";
import { canAttemptVerification, shouldSkipVerification, verifyTurnstileToken } from "../src/lib/turnstile.js";

describe("shouldSkipVerification", () => {
  it("skips (returns true) when disabled", () => {
    expect(shouldSkipVerification(false)).toBe(true);
  });

  it("does not skip when enabled", () => {
    expect(shouldSkipVerification(true)).toBe(false);
  });
});

describe("canAttemptVerification", () => {
  it("requires both a secret key and a token", () => {
    expect(canAttemptVerification("secret", "token")).toBe(true);
    expect(canAttemptVerification(undefined, "token")).toBe(false);
    expect(canAttemptVerification("secret", undefined)).toBe(false);
    expect(canAttemptVerification(undefined, undefined)).toBe(false);
  });
});

describe("verifyTurnstileToken (default env: TURNSTILE_ENABLED=false)", () => {
  it("short-circuits true with no network call when disabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await verifyTurnstileToken(undefined);
    expect(result).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
