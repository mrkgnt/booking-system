import { useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmBooking } from "@/lib/api/booking.js";

type Props = {
  apiBaseUrl: string;
  tenantSlug: string;
  devConfirmUrl?: string;
  onConfirmed: () => void;
};

function extractToken(devConfirmUrl: string): string | null {
  try {
    return new URL(devConfirmUrl).searchParams.get("token");
  } catch {
    return null;
  }
}

// Step 4 of the booking flow (issue #14): the double opt-in confirmation
// step, against POST /bookings/confirm unchanged. Real notification
// delivery is stubbed project-wide (no email/SMS provider chosen yet, see
// CLAUDE.md) — apps/api instead returns a dev-only `_dev_confirm_url` field
// (NODE_ENV !== "production") carrying a real, usable token. This step
// always shows the production-shaped "check your email/phone" messaging,
// and additionally renders a "confirm now" button whenever a
// devConfirmUrl was actually returned, so a real browser session (and this
// app's own E2E suite) can complete the full flow without a real inbox —
// the same mechanism apps/admin's dev flow already relies on. The button
// is naturally absent against a real production apps/api deployment,
// since that field won't exist there.
export default function ConfirmPendingStep({ apiBaseUrl, tenantSlug, devConfirmUrl, onConfirmed }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const devToken = devConfirmUrl ? extractToken(devConfirmUrl) : null;

  async function handleDevConfirm() {
    if (!devToken) return;
    setConfirming(true);
    setError(null);
    const result = await confirmBooking(apiBaseUrl, tenantSlug, devToken);
    setConfirming(false);
    if (result.ok) {
      onConfirmed();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-base font-semibold">Almost done</h2>
      <p className="text-sm text-muted-foreground">
        We've sent you a confirmation link — click it to finish booking your appointment.
      </p>

      {error && <p className="text-sm text-destructive">Couldn't confirm — please try the link again.</p>}

      {devToken && (
        <Button type="button" onClick={handleDevConfirm} disabled={confirming} variant="secondary">
          {confirming ? "Confirming…" : "Dev: confirm now"}
        </Button>
      )}
    </div>
  );
}
