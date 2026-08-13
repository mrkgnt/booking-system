// Double opt-in delivery — STUBBED per explicit decision (see CLAUDE.md):
// no email/SMS provider is chosen yet (SMS provider is still an open
// Decisions Log item; email isn't even named). Rather than blocking
// booking creation on a vendor decision/account setup, this logs the
// confirm link server-side so curl/Postman testing can proceed today.
//
// When a real provider is chosen later, only this file's internals change
// — callers (routes/bookings.ts) and the notification_log write pattern
// stay the same.

export type SendVerificationLinkParams = {
  channel: "email" | "sms";
  to: string;
  confirmUrl: string;
  locale: string;
};

export type SendVerificationLinkResult = {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

export async function sendVerificationLink(
  params: SendVerificationLinkParams,
): Promise<SendVerificationLinkResult> {
  // eslint-disable-next-line no-console
  console.log(
    `[notifications:stub] would send ${params.channel} to ${params.to} (locale=${params.locale}): ${params.confirmUrl}`,
  );

  // Honest about the real state — nothing was actually delivered. A
  // 'sent' status here would forge a delivery history that's confusing
  // later. See routes/bookings.ts for how the confirm link also surfaces
  // via a dev-only response field.
  return { status: "failed", error: "no provider configured — dev stub, see server log" };
}

export type SendManagementLinksParams = {
  channel: "email" | "sms";
  to: string;
  cancelUrl: string;
  rescheduleUrl: string;
  locale: string;
};

export type SendManagementLinksResult = {
  cancel: SendVerificationLinkResult;
  reschedule: SendVerificationLinkResult;
};

// Sent once a booking is confirmed — same stub approach as
// sendVerificationLink (log server-side, return the honest 'failed'
// no-provider state). Kept separate from sendVerificationLink rather than
// generalizing that function's params, since its "confirmUrl" naming/single
// link is specific to the double opt-in step and already has callers/tests.
export async function sendManagementLinks(
  params: SendManagementLinksParams,
): Promise<SendManagementLinksResult> {
  const cancel = await sendVerificationLink({
    channel: params.channel,
    to: params.to,
    confirmUrl: params.cancelUrl,
    locale: params.locale,
  });
  const reschedule = await sendVerificationLink({
    channel: params.channel,
    to: params.to,
    confirmUrl: params.rescheduleUrl,
    locale: params.locale,
  });
  return { cancel, reschedule };
}
