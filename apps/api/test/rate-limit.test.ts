import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { checkRateLimit, rateLimitMiddleware, resetRateLimitBuckets } from "../src/middleware/rate-limit.js";

describe("checkRateLimit (pure)", () => {
  it("allows requests up to the max, then blocks", () => {
    const key = "test-key-1";
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 15)).toBe(true);
    }
    expect(checkRateLimit(key, 3, 15)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = "test-key-2";
    const start = 1_000_000;
    expect(checkRateLimit(key, 1, 15, start)).toBe(true);
    expect(checkRateLimit(key, 1, 15, start)).toBe(false);
    // 16 minutes later — window (15min) has elapsed
    expect(checkRateLimit(key, 1, 15, start + 16 * 60_000)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    expect(checkRateLimit("key-a", 1, 15)).toBe(true);
    expect(checkRateLimit("key-b", 1, 15)).toBe(true);
    expect(checkRateLimit("key-a", 1, 15)).toBe(false);
  });
});

describe("rateLimitMiddleware", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("returns 429 once the configured max is exceeded", async () => {
    const app = new Hono();
    app.get("/limited", rateLimitMiddleware, (c) => c.json({ ok: true }));

    const headers = { "x-forwarded-for": "203.0.113.5" };
    // Default env: RATE_LIMIT_MAX_ATTEMPTS=5
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/limited", { headers });
      expect(res.status).toBe(200);
    }
    const blocked = await app.request("/limited", { headers });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
  });

  it("tracks different IPs independently", async () => {
    const app = new Hono();
    app.get("/limited", rateLimitMiddleware, (c) => c.json({ ok: true }));

    for (let i = 0; i < 5; i++) {
      await app.request("/limited", { headers: { "x-forwarded-for": "203.0.113.9" } });
    }
    const otherIp = await app.request("/limited", { headers: { "x-forwarded-for": "203.0.113.10" } });
    expect(otherIp.status).toBe(200);
  });
});
