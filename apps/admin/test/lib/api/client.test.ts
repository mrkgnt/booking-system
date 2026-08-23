import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "../../../src/lib/api/client.js";

const config = { baseUrl: "http://localhost:8081", tenantSlug: "dentdi", accessToken: "test-token" };

describe("apiFetch", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("retries once on a 403 and returns the result if the retry succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 403, ok: false, json: async () => ({ error: "not_authorized" }) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ staff: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch(config, "/admin/staff");

    expect(result).toEqual({ staff: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws ApiError if the retry also 403s", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 403, ok: false, json: async () => ({ error: "not_authorized" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch(config, "/admin/staff")).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-403 error status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 409, ok: false, json: async () => ({ error: "conflict" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch(config, "/admin/bookings")).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates ApiError as an instance with status and body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, ok: false, json: async () => ({ error: "boom" }) }));
    await expect(apiFetch(config, "/admin/bookings")).rejects.toBeInstanceOf(ApiError);
  });
});
