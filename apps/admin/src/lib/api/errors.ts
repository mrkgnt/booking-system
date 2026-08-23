import { ApiError } from "./client.js";

export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.body as { error?: string } | null)?.error;
    switch (code) {
      case "slot_unavailable": return "That time slot is no longer available.";
      case "already_finalized": return "This booking has already been cancelled or completed.";
      case "invalid_service": return "The selected service is not valid.";
      case "not_found": return "Booking not found — it may have been removed.";
      case "validation_error": return "Some fields are invalid — check the form and try again.";
      default: return `Request failed (${err.status}).`;
    }
  }
  return "Something went wrong. Please try again.";
}
