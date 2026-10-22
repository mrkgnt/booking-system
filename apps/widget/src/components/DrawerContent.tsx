import { useEffect, useReducer, useState } from "react";
import ServiceStep from "@/components/booking/ServiceStep";
import AvailabilityStep from "@/components/booking/AvailabilityStep";
import ContactStep, { type ContactInfo } from "@/components/booking/ContactStep";
import ConfirmPendingStep from "@/components/booking/ConfirmPendingStep";
import ConfirmedStep from "@/components/booking/ConfirmedStep";
import LocaleSwitcher from "@/components/LocaleSwitcher.js";
import CloseButton from "@/components/CloseButton.js";
import { useLocaleSwitcher } from "@/lib/use-locale-switcher.js";
import { createBooking, fetchAvailability } from "@/lib/api/booking.js";
import { initialFlowState, reduceFlowState, type FlowState } from "@/lib/booking/flow-state.js";
import { clearDraft, loadDraft, saveDraft, sessionStorageDraftStorage } from "@/lib/booking/draft-storage.js";
import { resolveDraftResume } from "@/lib/booking/draft-resume.js";
import type { TenantInfo } from "@/lib/api/tenant-info.js";
import { getMessage, resolveLocale } from "@/lib/i18n/messages.js";

// Issue #15 — the one FlowState variant that needs async revalidation
// before it can be resumed (see initialResume/the resume effect below).
type ContactDraft = Extract<FlowState, { step: "contact" }>;

type Props = {
  tenantInfo: TenantInfo | null;
  tenantSlug: string;
  apiBaseUrl: string;
  // Validated to "lv" | "ru" | "en" by drawer.astro (createBookingSchema's
  // own enum, apps/api/src/routes/bookings.schema.ts) whenever tenantInfo
  // is present, since this value also flows straight into POST /bookings'
  // payload below. When tenantInfo is null there's no tenant default
  // locale to validate against, so drawer.astro passes the raw
  // (possibly-unsupported) requested locale through instead — getMessage's
  // own resolveLocale call falls back to "en" for anything it doesn't
  // recognize, same as issue #11 built it. This is also the in-drawer
  // locale switcher's (issue #13) STARTING point only — once mounted, the
  // switcher's own activeLocale (not this prop) is the source of truth,
  // since the customer can change it client-side without a page reload.
  locale: string;
};

// Every evergreen browser this widget targets has crypto.randomUUID — same
// baseline assumption public/embed.js already makes elsewhere in this app.
function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

// Issue #15 — duplicated on purpose from AvailabilityStep.tsx's own
// (unexported) toDateKey rather than extracted into a shared util: the two
// callers want the SAME calendar-local key shape but from different inputs
// (the visitor's current browser date there vs. a resumed draft's saved
// slot.startsAt here), and this is a 4-line pure function — same "accepted,
// documented debt over premature abstraction" spirit as this file's other
// inline comments (e.g. the near-midnight timezone approximation noted in
// AvailabilityStep.tsx itself).
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The actual service → availability → contact → double opt-in confirm
// booking flow (issue #14), reusing apps/api's existing /availability,
// /bookings, /bookings/confirm contract unchanged. `tenantInfo === null`
// means the live /public/tenant-info fetch failed — invalid/inactive
// tenant slug or an apps/api outage (or, as is actually the case for the
// live "dentdi" tenant at the time this was built, business_profile.status
// being "onboarding" rather than "active"; see CLAUDE.md) — both
// converging on the same generic, locale-aware message (issue #11): no
// tenant-specific contact info, since that data is itself part of what
// failed to load.
export default function DrawerContent({ tenantInfo, tenantSlug, apiBaseUrl, locale }: Props) {
  if (!tenantInfo) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex justify-end p-2">
          <CloseButton locale={locale} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 pt-0 text-center">
          <p className="text-sm text-muted-foreground">{getMessage("unavailable", locale)}</p>
        </div>
      </div>
    );
  }

  return (
    <DrawerContentLoaded
      initialTenantInfo={tenantInfo}
      tenantSlug={tenantSlug}
      apiBaseUrl={apiBaseUrl}
      initialLocale={locale}
    />
  );
}

// Split out from the `tenantInfo === null` early return above so
// useLocaleSwitcher/useReducer/useState (which all need a plain
// unconditional top-level hook call) don't have to juggle
// conditional-hook-call rules in the parent.
function DrawerContentLoaded({
  initialTenantInfo,
  tenantSlug,
  apiBaseUrl,
  initialLocale,
}: {
  initialTenantInfo: TenantInfo;
  tenantSlug: string;
  apiBaseUrl: string;
  initialLocale: string;
}) {
  // tenantInfo/activeLocale here supersede the initial* props for
  // everything rendered below — switching locale (issue #13) re-fetches
  // the whole catalog for the new locale and swaps both in, so a service
  // picked before a mid-flow locale switch still resolves to the right
  // (now re-translated) name via its stable id.
  const { tenantInfo, activeLocale, isSwitching, switchLocale } = useLocaleSwitcher({
    apiBaseUrl,
    tenantSlug,
    initialTenantInfo,
    initialLocale,
  });

  // Issue #15 — resolves any saved draft once, synchronously, at mount.
  // "service"/"availability" drafts have nothing to revalidate
  // (resolveDraftResume(draft, null) resumes them outright), so they
  // become the reducer's actual initial state here. A "contact" draft DOES
  // have a locked-in slot that might have been taken while the customer
  // was away — that one case can't resolve synchronously, so it's handed
  // off via `pendingContactDraft` to the effect below instead, and the
  // reducer starts at the plain initial ("service") state meanwhile.
  const [initialResume] = useState(() => {
    // This initializer runs during Astro's SSR pass too (client:load still
    // produces an initial server-rendered markup, same as the
    // renderToStaticMarkup seam in test/components/drawer-content-locale-
    // switcher.test.tsx), where `window`/sessionStorage don't exist — there's
    // nothing to resume there anyway, since the real resume only matters
    // once this island is actually hydrated in a browser.
    const draft = typeof window !== "undefined" ? loadDraft(sessionStorageDraftStorage, tenantSlug) : null;
    if (!draft) return { state: initialFlowState(), pendingContactDraft: null as ContactDraft | null };
    if (draft.step !== "contact") {
      // draft is non-null here, so resolveDraftResume can never actually
      // return "none" — the fallback only exists to satisfy the type
      // checker, which can't see that from the function's own signature.
      const result = resolveDraftResume(draft, null);
      return {
        state: result.kind === "none" ? initialFlowState() : result.state,
        pendingContactDraft: null as ContactDraft | null,
      };
    }
    return { state: initialFlowState(), pendingContactDraft: draft };
  });

  const [state, dispatch] = useReducer(reduceFlowState, initialResume.state);
  const [pendingContactDraft, setPendingContactDraft] = useState(initialResume.pendingContactDraft);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  // Runs once, exactly for the "contact draft needs revalidation" case
  // captured by initialResume above — a fresh GET /availability call for
  // the draft's own service/staff/date decides whether the saved slot is
  // still free (resume straight to "contact") or was taken while the
  // customer was away (bounce back to "availability" with the same notice
  // flow-state.ts's own SLOT_TAKEN transition already produces).
  useEffect(() => {
    if (!pendingContactDraft) return;
    let cancelled = false;
    (async () => {
      const draft = pendingContactDraft;
      const result = await fetchAvailability(apiBaseUrl, tenantSlug, {
        serviceId: draft.serviceId,
        staffId: draft.staffId,
        date: toDateKey(new Date(draft.slot.startsAt)),
      });
      if (cancelled) return;
      const resumed = resolveDraftResume(draft, result.ok ? result.slots : null);
      // Same non-null-draft-implies-never-"none" reasoning as the
      // initializer above.
      dispatch({ type: "RESUME_DRAFT", state: resumed.kind === "none" ? initialFlowState() : resumed.state });
      setPendingContactDraft(null);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally mount-only — pendingContactDraft is only ever set once
    // (at init) and cleared, never reassigned, so there's nothing to
    // re-run against later in this component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persists every draftable step change (issue #15) — skipped while a
  // contact draft is still being revalidated above, since the placeholder
  // "service" state during that window isn't real progress and would
  // overwrite the still-valid saved draft with it.
  useEffect(() => {
    if (pendingContactDraft) return;
    saveDraft(sessionStorageDraftStorage, tenantSlug, state);
  }, [state, tenantSlug, pendingContactDraft]);

  async function handleContactSubmit(contact: ContactInfo) {
    if (state.step !== "contact") return;
    setSubmitting(true);
    setSubmitError(undefined);
    const result = await createBooking(apiBaseUrl, tenantSlug, {
      serviceId: state.serviceId,
      staffId: state.staffId,
      startsAt: state.slot.startsAt,
      // resolveLocale narrows to createBookingSchema's exact
      // "lv" | "ru" | "en" enum (same helper issue #11 built for the
      // unavailable message) — belt-and-suspenders on top of drawer.astro
      // already validating this before it ever reaches here. Uses
      // activeLocale (whatever the switcher is currently showing), not
      // the original initialLocale prop, so a mid-flow locale switch is
      // actually reflected in the booking that gets created.
      locale: resolveLocale(activeLocale),
      customer: contact,
      idempotencyKey: generateIdempotencyKey(),
    });
    setSubmitting(false);
    if (result.ok) {
      // A real booking now exists server-side — nothing left to resume.
      clearDraft(sessionStorageDraftStorage, tenantSlug);
      dispatch({
        type: "BOOKING_CREATED",
        bookingId: String((result.booking as { id?: unknown }).id ?? ""),
        devConfirmUrl: result.devConfirmUrl,
      });
      return;
    }
    // The slot can legitimately be taken by someone else between picking
    // it in AvailabilityStep and submitting contact info here — route back
    // to availability with a notice (story 13) rather than a dead-end
    // error, matching the one error apps/api can return for exactly this
    // (409 slot_unavailable, see bookings.ts).
    if (result.error === "slot_unavailable") {
      dispatch({ type: "SLOT_TAKEN" });
      return;
    }
    setSubmitError("Something went wrong — please try again.");
  }

  function staffForService(serviceId: string) {
    return tenantInfo.staff
      .filter((member) =>
        tenantInfo.staffServices.some((link) => link.serviceId === serviceId && link.staffId === member.id),
      )
      .map((member) => ({ id: member.id, name: member.name }));
  }

  // Issue #15 — while the one async revalidation case above is still in
  // flight, show the brief locale-aware note rather than the "service"
  // step the reducer happens to be sitting at underneath (that state is a
  // placeholder, not real — rendering ServiceStep here would flash the
  // wrong step for an instant before RESUME_DRAFT corrects it).
  if (pendingContactDraft) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex justify-end p-2">
          <CloseButton locale={activeLocale} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 pt-0 text-center">
          <p className="text-sm text-muted-foreground">{getMessage("resuming_draft", activeLocale)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{tenantInfo.tenant.name}</h1>
        <div className="flex items-center gap-1">
          <LocaleSwitcher
            supportedLocales={tenantInfo.tenant.supportedLocales}
            activeLocale={activeLocale}
            onLocaleChange={switchLocale}
            disabled={isSwitching}
          />
          <CloseButton locale={activeLocale} />
        </div>
      </header>

      {state.step === "service" && (
        <ServiceStep
          services={tenantInfo.services}
          onSelect={(serviceId) => dispatch({ type: "SELECT_SERVICE", serviceId })}
        />
      )}

      {state.step === "availability" && (
        <AvailabilityStep
          apiBaseUrl={apiBaseUrl}
          tenantSlug={tenantSlug}
          serviceId={state.serviceId}
          staffOptions={staffForService(state.serviceId)}
          staffId={state.staffId}
          notice={state.notice}
          onSelectStaff={(staffId) => dispatch({ type: "SELECT_STAFF", staffId })}
          onSelectSlot={(slot) => dispatch({ type: "SELECT_SLOT", slot })}
          onBack={() => dispatch({ type: "BACK" })}
        />
      )}

      {state.step === "contact" && (
        <ContactStep
          submitting={submitting}
          error={submitError}
          initialValue={state.contactDraft}
          onChange={(contact) => dispatch({ type: "UPDATE_CONTACT_DRAFT", contact })}
          onSubmit={handleContactSubmit}
          onBack={() => dispatch({ type: "BACK" })}
        />
      )}

      {state.step === "confirm_pending" && (
        <ConfirmPendingStep
          apiBaseUrl={apiBaseUrl}
          tenantSlug={tenantSlug}
          devConfirmUrl={state.devConfirmUrl}
          onConfirmed={() => dispatch({ type: "CONFIRMED" })}
        />
      )}

      {state.step === "confirmed" && (
        <ConfirmedStep
          slot={state.slot}
          onRestart={() => {
            // Already cleared on BOOKING_CREATED above — this covers the
            // (currently unreachable, but cheap to guard) case of RESTART
            // ever being wired to a step that could still have a live draft.
            clearDraft(sessionStorageDraftStorage, tenantSlug);
            dispatch({ type: "RESTART" });
          }}
        />
      )}

      <footer className="pt-2 text-center text-xs text-muted-foreground">Powered by [Platform]</footer>
    </div>
  );
}
