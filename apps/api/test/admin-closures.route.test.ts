import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const ROUTES: Array<[string, string]> = [
  ["GET", "/admin/closures"],
  ["POST", "/admin/closures"],
  ["DELETE", "/admin/closures/00000000-0000-0000-0000-000000000001"],
];

describe("admin closures routes — tenant and auth shape checks", () => {
  it.each(ROUTES)("%s %s 401s with no Authorization header", async (method, path) => {
    const res = await app.request(path, {
      method,
      headers: { "X-Tenant-Slug": "dentdi", "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : "{}",
    });
    expect(res.status).toBe(401);
  });
});
