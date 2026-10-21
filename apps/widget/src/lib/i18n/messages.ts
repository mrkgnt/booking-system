// Minimal, reusable locale-message lookup for apps/widget's static UI
// strings. Deliberately small — not a full i18n framework — built for
// issue #11's one "temporarily unavailable" string, but shaped (a message
// table keyed by message key, then locale, plus a shared `resolveLocale`)
// so issue #13's locale switcher can extend it with more keys/locales
// later without redesigning it.
//
// Matches the platform's launch locale set (CLAUDE.md: "Locales at launch
// | LV + RU + EN") and mirrors apps/api's existing fallback shape
// (src/routes/tenant-info.ts's own resolveLocale) without importing it —
// apps/widget stays self-contained, no shared packages (ADR-0004).

export type Locale = "lv" | "ru" | "en";

export const DEFAULT_LOCALE: Locale = "en";

const SUPPORTED_LOCALES: readonly Locale[] = ["lv", "ru", "en"];

// Falls back to `fallback` (DEFAULT_LOCALE/"en" when not given) for
// anything missing/unrecognized — never throws, since the caller (e.g. the
// drawer's failure path) may itself be handling a failure and has no
// business data (tenant default locale) available to fall back to
// instead. The optional second param (issue #14) lets a caller that DOES
// have a Tenant's own default_locale layer onto it instead of hardcoded
// "en" — e.g. `resolveLocale(requestedLocale, resolveLocale(tenant.defaultLocale))`.
export function resolveLocale(locale?: string | null, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return locale as Locale;
  }
  return fallback;
}

export type MessageKey = "unavailable" | "language";

const MESSAGES: Record<MessageKey, Record<Locale, string>> = {
  unavailable: {
    en: "Booking is temporarily unavailable. Please check back soon.",
    lv: "Rezervēšana īslaicīgi nav pieejama. Lūdzu, mēģiniet vēlāk.",
    ru: "Бронирование временно недоступно. Пожалуйста, попробуйте позже.",
  },
  // The in-drawer locale switcher's own label (issue #13). Lives here
  // rather than in src/lib/locale.ts's own map so there's exactly one
  // locale->string lookup mechanism in this app, not two that could drift
  // out of sync on SUPPORTED_LOCALES/fallback behavior.
  language: {
    en: "Language",
    lv: "Valoda",
    ru: "Язык",
  },
};

export function getMessage(key: MessageKey, locale?: string | null): string {
  return MESSAGES[key][resolveLocale(locale)];
}
