import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("CORS on /admin/*", () => {
  it("reflects the configured admin origin on a preflight request", async () => {
    const res = await app.request("/admin/me", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:4321", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:4321");
  });

  it("does not add CORS headers for a disallowed origin", async () => {
    const res = await app.request("/admin/me", {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example.com", "Access-Control-Request-Method": "GET" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
