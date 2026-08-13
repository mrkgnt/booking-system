import type { MiddlewareHandler } from "hono";
import { env } from "../config/env.js";

// In-memory fixed-window rate limiter, keyed by client IP. Explicitly
// insufficient once deployed to serverless/multi-instance (no shared
// memory across invocations) — real fix is Cloudflare rate rules or
// Upstash Redis, deferred until hosting is decided (see CLAUDE.md). This
// exists so the requirement isn't silently skipped while that's unresolved.

type WindowState = { count: number; windowStartMs: number };

const buckets = new Map<string, WindowState>();

function getClientIp(headerValue: string | undefined): string {
  // x-forwarded-for can be a comma-separated list; the first entry is the
  // original client. Falls back to a constant key locally (no proxy in
  // front of `tsx watch`), which means local testing shares one bucket —
  // fine for curl/Postman testing, not meaningful once actually deployed.
  return headerValue?.split(",")[0]?.trim() ?? "unknown";
}

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMinutes: number,
  now: number = Date.now(),
): boolean {
  const windowMs = windowMinutes * 60_000;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartMs >= windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return true;
  }

  if (existing.count >= maxAttempts) {
    return false;
  }

  existing.count += 1;
  return true;
}

// Exposed for tests — avoids cross-test bucket pollution.
export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const key = getClientIp(c.req.header("x-forwarded-for"));
  const allowed = checkRateLimit(key, env.RATE_LIMIT_MAX_ATTEMPTS, env.RATE_LIMIT_WINDOW_MINUTES);

  if (!allowed) {
    return c.json({ error: "rate_limited" }, 429);
  }

  await next();
};
