import { describe, expect, it, vi } from "vitest";
import { sendVerificationLink } from "../src/lib/notifications.js";

describe("sendVerificationLink (stub)", () => {
  it("returns an honest 'failed: no provider configured' result", async () => {
    const result = await sendVerificationLink({
      channel: "email",
      to: "patient@example.com",
      confirmUrl: "https://example.com/confirm?token=abc",
      locale: "en",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/no provider configured/);
  });

  it("logs the confirm link server-side", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendVerificationLink({
      channel: "sms",
      to: "+37120000000",
      confirmUrl: "https://example.com/confirm?token=xyz",
      locale: "lv",
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("https://example.com/confirm?token=xyz"));
    logSpy.mockRestore();
  });
});
