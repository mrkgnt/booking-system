import { randomBytes, createHash } from "node:crypto";

// Verification tokens: the raw token only ever exists in the outbound link
// (email/SMS) — booking_verification_tokens.token_hash stores a sha256
// hash, never the raw value, matching the schema's own design intent.

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
