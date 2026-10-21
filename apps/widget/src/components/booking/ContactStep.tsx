import { useState } from "react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ContactInfo = { name: string; email?: string; phone?: string };

type Props = {
  submitting: boolean;
  error?: string;
  onSubmit: (contact: ContactInfo) => void;
  onBack: () => void;
};

// Step 3 of the booking flow (issue #14): matches createBookingSchema's
// `customer` shape exactly (apps/api/src/routes/bookings.schema.ts) — name
// required, email-or-phone required (not both), consent must be literally
// `true`. Client-side validation here is just UX (disables submit until
// satisfied) — the server re-validates everything regardless.
export default function ContactStep({ submitting, error, onSubmit, onBack }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  const hasContact = email.trim().length > 0 || phone.trim().length > 0;
  const canSubmit = name.trim().length > 0 && hasContact && consent && !submitting;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  }

  return (
    <form className="flex flex-1 flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="text-base font-semibold">Your details</h2>

      {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-phone">Phone</Label>
        <Input
          id="contact-phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={submitting}
        />
      </div>

      {!hasContact && (
        <p className="text-xs text-muted-foreground">Enter an email or phone number so we can reach you.</p>
      )}

      <Label className="flex items-start gap-2 font-normal">
        <Checkbox
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          disabled={submitting}
        />
        <span className="text-sm">I agree to be contacted about this booking.</span>
      </Label>

      <div className="mt-auto flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="submit" disabled={!canSubmit} className="flex-1">
          {submitting ? "Booking…" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}
