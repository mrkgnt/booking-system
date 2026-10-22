// Booking draft persistence (issue #15 / GLOSSARY.md "Booking draft").
//
// Pure, DOM-free, testable-without-jsdom per this ticket's own testing
// decision — real `window.sessionStorage` satisfies the tiny `DraftStorage`
// interface below (getItem/setItem/removeItem are all it has in common
// with the Web Storage API), so production code passes the real thing and
// vitest passes an in-memory fake (see test/lib/booking/draft-storage.test.ts).
//
// Scoped to the widget's own origin (sessionStorage is already origin-
// scoped by the browser) AND keyed by tenant slug (draftStorageKey) — the
// widget is one shared origin across every Tenant (ADR-0004), so the key
// itself is what stops one Tenant's in-progress draft from leaking into
// another Tenant's drawer in the same browser session.
import type { FlowState } from "./flow-state.js";

export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const KEY_PREFIX = "platform-widget:draft:";

export function draftStorageKey(tenantSlug: string): string {
  return `${KEY_PREFIX}${tenantSlug}`;
}

// Only these three steps are ever worth resuming into — by the time a
// FlowState reaches "confirm_pending" a real POST /bookings has already
// succeeded (the draft is explicitly cleared at that point by the caller,
// see DrawerContent.tsx) and "confirmed" is a terminal state with nothing
// left to resume. Kept as its own exported predicate so the "what counts as
// an in-progress draft" rule has exactly one place to look it up, rather
// than duplicating this list anywhere else that needs it later.
export function isDraftableStep(state: FlowState): boolean {
  return state.step === "service" || state.step === "availability" || state.step === "contact";
}

// Persists a draftable step; for anything else (confirm_pending/confirmed)
// this clears any existing draft instead of writing it — belt-and-suspenders
// alongside the explicit clearDraft() call DrawerContent makes right after
// a successful POST /bookings or an explicit restart, so a stale draft can
// never survive past either of those even if a caller forgets to clear it.
export function saveDraft(storage: DraftStorage, tenantSlug: string, state: FlowState): void {
  if (!isDraftableStep(state)) {
    clearDraft(storage, tenantSlug);
    return;
  }
  storage.setItem(draftStorageKey(tenantSlug), JSON.stringify(state));
}

// Never throws — a corrupt/foreign value under this key (shouldn't happen
// in practice, since nothing else writes to this key, but sessionStorage is
// shared browser-wide state outside this module's control) is treated the
// same as "no draft", not a crash.
export function loadDraft(storage: DraftStorage, tenantSlug: string): FlowState | null {
  const raw = storage.getItem(draftStorageKey(tenantSlug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FlowState;
  } catch {
    return null;
  }
}

export function clearDraft(storage: DraftStorage, tenantSlug: string): void {
  storage.removeItem(draftStorageKey(tenantSlug));
}

// The real adapter used in the browser. Lazily reads `window.sessionStorage`
// on each call (not captured at module load) so importing this module stays
// safe outside a browser (SSR, vitest) as long as nothing actually calls
// these methods there.
export const sessionStorageDraftStorage: DraftStorage = {
  getItem: (key) => window.sessionStorage.getItem(key),
  setItem: (key, value) => window.sessionStorage.setItem(key, value),
  removeItem: (key) => window.sessionStorage.removeItem(key),
};
