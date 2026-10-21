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
// active in the drawer. Originally this file had its own standalone
// LANGUAGE_LABELS map + fallback, built in parallel with issue #11's
// separate src/lib/i18n/messages.ts (same "resolveLocale + a
// key-then-locale message table" shape, built independently per that
// ticket's own guidance). Reconciled at merge time (issue #13 x #11/#14)
// into one mechanism: messages.ts is now the single locale->string lookup
// in this app — this is a thin wrapper over its "language" key so callers
// of this module (LocaleSwitcher.tsx) keep their existing one-arg call
// shape without needing to know that detail.
import { getMessage } from "./i18n/messages.js";

export function resolveLanguageLabel(locale: string): string {
  return getMessage("language", locale);
}
