import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestClose } from "@/lib/close-widget.js";
import { getMessage } from "@/lib/i18n/messages.js";

type Props = { locale: string };

// Rendered in every DrawerContent branch (loaded, "unavailable", and
// "resuming_draft") — on mobile the drawer is a full-screen takeover with
// no dimmed backdrop to tap (public/embed.js's mobile breakpoint CSS), so
// this is the only way to dismiss it there, including from the two failure/
// loading states that previously had no header at all.
export default function CloseButton({ locale }: Props) {
  const label = getMessage("close", locale);
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={requestClose}>
      <X className="size-4" />
    </Button>
  );
}
