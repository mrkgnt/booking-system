// Pure, DOM-free locale helpers for the in-drawer locale switcher (issue
// #13). Kept separate from the switcher's JSX so this logic is testable
// without a DOM/jsdom — matching the vitest "secondary seam" convention
// already established by tenant-info.ts's buildTenantInfoUrl.

// A single-locale Tenant must never render the switcher control at all;
// a multi-locale one always should. `>1`, not `!==1`, so zero/undefined
// locales also correctly stay hidden rather than rendering an empty list.
export function shouldShowLocaleSwitcher(supportedLocales: string[]): boolean {
  return supportedLocales.length > 1;
}

// The switcher's own "Language" label, localized for the locale currently
// active in the drawer. Deliberately tiny and scoped to just this one
// string — NOT a general i18n dictionary for the rest of the widget's UI.
// Issue #13's parent spec flags that issue #11 (failure-UX ticket, running
// in parallel off the same base commit) may build its own locale-keyed
// string helper for its "unavailable" message; this was built independently
// per that guidance, and can be reconciled/merged with #11's helper at
// merge time if one already exists by then.
const LANGUAGE_LABELS: Record<string, string> = {
  en: "Language",
  lv: "Valoda",
  ru: "Язык",
};

export function resolveLanguageLabel(locale: string): string {
  return LANGUAGE_LABELS[locale] ?? LANGUAGE_LABELS.en;
}
