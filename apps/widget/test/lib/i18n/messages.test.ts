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
});
