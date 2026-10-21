import { useReducer, useState } from "react";
import ServiceStep from "@/components/booking/ServiceStep";
import AvailabilityStep from "@/components/booking/AvailabilityStep";
import ContactStep, { type ContactInfo } from "@/components/booking/ContactStep";
import ConfirmPendingStep from "@/components/booking/ConfirmPendingStep";
import ConfirmedStep from "@/components/booking/ConfirmedStep";
import LocaleSwitcher from "@/components/LocaleSwitcher.js";
import { useLocaleSwitcher } from "@/lib/use-locale-switcher.js";
import { createBooking } from "@/lib/api/booking.js";
import { initialFlowState, reduceFlowState } from "@/lib/booking/flow-state.js";
import type { TenantInfo } from "@/lib/api/tenant-info.js";
import { getMessage, resolveLocale } from "@/lib/i18n/messages.js";

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
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">{getMessage("unavailable", locale)}</p>
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

  const [state, dispatch] = useReducer(reduceFlowState, initialFlowState());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

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

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{tenantInfo.tenant.name}</h1>
        <LocaleSwitcher
          supportedLocales={tenantInfo.tenant.supportedLocales}
          activeLocale={activeLocale}
          onLocaleChange={switchLocale}
          disabled={isSwitching}
        />
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
        <ConfirmedStep slot={state.slot} onRestart={() => dispatch({ type: "RESTART" })} />
      )}

      <footer className="pt-2 text-center text-xs text-muted-foreground">Powered by [Platform]</footer>
    </div>
  );
}
