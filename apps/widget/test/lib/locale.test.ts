import { describe, expect, it } from "vitest";
import { resolveLanguageLabel, shouldShowLocaleSwitcher } from "../../src/lib/locale.js";

// Pure, DOM-free seam — the switcher's own visibility gate and the
// localized "Language" label shown next to the control. Issue #13's
// acceptance criteria: the switcher renders only when a Tenant supports
// more than one locale, and never for a single-locale Tenant.
// resolveLanguageLabel is a thin wrapper over src/lib/i18n/messages.ts's
// "language" key (see that file's own test for the underlying lookup) —
// kept here as the switcher's own one-arg convenience entry point rather
// than making LocaleSwitcher.tsx call getMessage directly.
describe("shouldShowLocaleSwitcher", () => {
  it("returns false for a single supported locale", () => {
    expect(shouldShowLocaleSwitcher(["en"])).toBe(false);
  });

  it("returns false for zero supported locales", () => {
    expect(shouldShowLocaleSwitcher([])).toBe(false);
  });

  it("returns true when more than one locale is supported", () => {
    expect(shouldShowLocaleSwitcher(["en", "lv", "ru"])).toBe(true);
  });
});

describe("resolveLanguageLabel", () => {
  it("returns the localized 'Language' label for a known locale", () => {
    expect(resolveLanguageLabel("en")).toBe("Language");
    expect(resolveLanguageLabel("lv")).toBe("Valoda");
    expect(resolveLanguageLabel("ru")).toBe("Язык");
  });

  it("falls back to the English label for an unrecognized locale", () => {
    expect(resolveLanguageLabel("fr")).toBe("Language");
  });
});
