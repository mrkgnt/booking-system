import { describe, expect, it, vi } from "vitest";
import { sendManagementLinks, sendVerificationLink } from "../src/lib/notifications.js";

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

describe("sendManagementLinks (stub)", () => {
  it("logs both the cancel and reschedule links and returns honest failed results for each", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await sendManagementLinks({
      channel: "email",
      to: "patient@example.com",
      cancelUrl: "https://example.com/bookings/cancel?token=abc",
      rescheduleUrl: "https://example.com/bookings/reschedule?token=def",
      locale: "en",
    });

    expect(result.cancel.status).toBe("failed");
    expect(result.cancel.error).toMatch(/no provider configured/);
    expect(result.reschedule.status).toBe("failed");
    expect(result.reschedule.error).toMatch(/no provider configured/);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://example.com/bookings/cancel?token=abc"),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://example.com/bookings/reschedule?token=def"),
    );
    logSpy.mockRestore();
  });

  it("makes no network calls (pure console logging)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "log").mockImplementation(() => {});
    await sendManagementLinks({
      channel: "sms",
      to: "+37120000000",
      cancelUrl: "https://example.com/bookings/cancel?token=abc",
      rescheduleUrl: "https://example.com/bookings/reschedule?token=def",
      locale: "lv",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    vi.restoreAllMocks();
  });
});
