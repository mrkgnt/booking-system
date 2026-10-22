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

// "resuming_draft": issue #15's brief "checking your previous selection"
// note shown only during the one async window a resumed draft can have —
// re-validating a saved "contact" step's slot against a fresh availability
// check before deciding whether to resume there or bounce back. "service"/
// "availability" drafts resume synchronously (no locked-in slot to check),
// so this message never appears for those.
export type MessageKey = "unavailable" | "language" | "resuming_draft" | "close";

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
  resuming_draft: {
    en: "Resuming your previous selection…",
    lv: "Jūsu iepriekšējā izvēle tiek atjaunota…",
    ru: "Восстанавливаем ваш предыдущий выбор…",
  },
  // The close-button aria-label (mobile full-screen takeover has no
  // backdrop to tap — see public/embed.js's mobile breakpoint CSS — so
  // this button is the only way to dismiss the drawer there).
  close: {
    en: "Close",
    lv: "Aizvērt",
    ru: "Закрыть",
  },
};

export function getMessage(key: MessageKey, locale?: string | null): string {
  return MESSAGES[key][resolveLocale(locale)];
}
