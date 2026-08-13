import { env } from "../config/env.js";

// Bot protection — env-gated so local/curl testing isn't blocked before a
// real Cloudflare Turnstile site key exists. When TURNSTILE_ENABLED is
// false (default), short-circuits true with no network call. When enabled
// but misconfigured (no secret key), fails closed — verification failing
// should never silently degrade to "allow everything" once it's been
// explicitly turned on.

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Pure, directly-testable decision logic — separated from the env read and
// the network call so both branches are provable without mocking either.
export function shouldSkipVerification(enabled: boolean): boolean {
  return !enabled;
}

export function canAttemptVerification(
  secretKey: string | undefined,
  token: string | undefined,
): boolean {
  return Boolean(secretKey && token);
}

export async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
  if (shouldSkipVerification(env.TURNSTILE_ENABLED)) {
    return true;
  }

  if (!canAttemptVerification(env.TURNSTILE_SECRET_KEY, token)) {
    return false;
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as { success: boolean };
  return result.success === true;
}
