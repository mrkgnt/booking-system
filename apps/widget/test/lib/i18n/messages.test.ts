import { describe, expect, it } from "vitest";
import { getMessage, resolveLocale } from "../../../src/lib/i18n/messages.js";

// Seam: the pure locale-resolution + message-lookup logic behind the
// drawer's "temporarily unavailable" copy (issue #11). Deliberately kept
// DOM-free and framework-free — this is the one piece of real logic behind
// an otherwise-static string, and the shape (resolveLocale + a
// key-then-locale message table) is meant to be reusable by #13's locale
// switcher later without redesigning it.

describe("resolveLocale", () => {
  it("returns the given locale when it's one of the platform's supported locales", () => {
    expect(resolveLocale("lv")).toBe("lv");
    expect(resolveLocale("ru")).toBe("ru");
    expect(resolveLocale("en")).toBe("en");
  });

  it("falls back to en for an unsupported locale", () => {
    expect(resolveLocale("fr")).toBe("en");
  });

  it("falls back to en when no locale is given", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });

  // Issue #14: drawer.astro layers this on top of the Tenant's own
  // default_locale (a second resolveLocale call) rather than hardcoded
  // "en" whenever a requested locale is missing/unsupported but a
  // Tenant default IS known (i.e. tenantInfo loaded successfully).
  it("falls back to the given fallback locale, not en, when one is provided", () => {
    expect(resolveLocale(undefined, "lv")).toBe("lv");
    expect(resolveLocale("fr", "ru")).toBe("ru");
  });

  it("still returns the given locale over the fallback when it's supported", () => {
    expect(resolveLocale("en", "lv")).toBe("en");
  });
});

describe("getMessage", () => {
  it("returns the localized unavailable message for each supported locale", () => {
    expect(getMessage("unavailable", "en")).toBe("Booking is temporarily unavailable. Please check back soon.");
    expect(getMessage("unavailable", "lv")).toBe("Rezervēšana īslaicīgi nav pieejama. Lūdzu, mēģiniet vēlāk.");
    expect(getMessage("unavailable", "ru")).toBe("Бронирование временно недоступно. Пожалуйста, попробуйте позже.");
  });

  it("falls back to the en message for an unsupported/missing locale", () => {
    expect(getMessage("unavailable", "fr")).toBe("Booking is temporarily unavailable. Please check back soon.");
    expect(getMessage("unavailable")).toBe("Booking is temporarily unavailable. Please check back soon.");
  });

  // Issue #13's in-drawer locale switcher label — added here (not a
  // second standalone lookup in src/lib/locale.ts) once the merge with
  // issue #11/#14's work made it clear this file is the app's one
  // locale->string mechanism. src/lib/locale.ts's resolveLanguageLabel is
  // a thin single-arg wrapper over this same key, covered by its own
  // test (test/lib/locale.test.ts).
  it("returns the localized switcher label for each supported locale", () => {
    expect(getMessage("language", "en")).toBe("Language");
    expect(getMessage("language", "lv")).toBe("Valoda");
    expect(getMessage("language", "ru")).toBe("Язык");
  });
});
