import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBookingsQuery, cancelBooking, listBookings } from "../../../src/lib/api/bookings.js";

const config = { baseUrl: "http://localhost:8787", tenantSlug: "dentdi", accessToken: "test-token" };

describe("buildBookingsQuery", () => {
  it("returns empty string with no filters", () => {
    expect(buildBookingsQuery({})).toBe("");
  });
  it("serializes only the provided filters", () => {
    expect(buildBookingsQuery({ status: "confirmed", staffId: "abc" })).toBe("?staffId=abc&status=confirmed");
  });
});

describe("listBookings", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends X-Tenant-Slug and bearer token headers, returns the bookings array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ bookings: [{ id: "b1" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listBookings(config, { status: "confirmed" });

    expect(result).toEqual([{ id: "b1" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8787/admin/bookings?status=confirmed");
    expect(init.headers["X-Tenant-Slug"]).toBe("dentdi");
    expect(init.headers["Authorization"]).toBe("Bearer test-token");
  });

  it("throws ApiError with status and body on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 409, ok: false, json: async () => ({ error: "conflict" }) }));
    await expect(listBookings(config)).rejects.toMatchObject({ status: 409, body: { error: "conflict" } });
  });
});

describe("cancelBooking", () => {
  it("posts to the cancel endpoint and returns the updated booking", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ booking: { id: "b1", status: "cancelled" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await cancelBooking(config, "b1");
    expect(result.status).toBe("cancelled");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8787/admin/bookings/b1/cancel");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});
