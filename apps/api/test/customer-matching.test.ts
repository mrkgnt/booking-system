import { describe, expect, it } from "vitest";
import { selectMatchingCustomer, type CustomerCandidate } from "../src/lib/customer-matching.js";

const candidates: CustomerCandidate[] = [
  { id: "p1", email: "jane@example.com", phone: null, createdAt: "2027-01-01T00:00:00Z" },
  { id: "p2", email: null, phone: "+37120000000", createdAt: "2027-01-02T00:00:00Z" },
  { id: "p3", email: "old-dup@example.com", phone: "+37130000000", createdAt: "2027-01-01T00:00:00Z" },
  { id: "p4", email: "new-dup@example.com", phone: "+37130000000", createdAt: "2027-01-05T00:00:00Z" },
];

describe("selectMatchingCustomer", () => {
  it("matches on exact email (case/whitespace-insensitive)", () => {
    const match = selectMatchingCustomer(candidates, { email: "  Jane@Example.com  " });
    expect(match?.id).toBe("p1");
  });

  it("matches on exact phone (formatting-insensitive)", () => {
    const match = selectMatchingCustomer(candidates, { phone: "+371 20 000 000" });
    expect(match?.id).toBe("p2");
  });

  it("returns null when nothing matches (new customer)", () => {
    const match = selectMatchingCustomer(candidates, { email: "nobody@example.com" });
    expect(match).toBeNull();
  });

  it("picks the most-recently-created match when multiple candidates share a phone", () => {
    const match = selectMatchingCustomer(candidates, { phone: "+37130000000" });
    expect(match?.id).toBe("p4");
  });

  it("returns null when neither email nor phone is supplied", () => {
    const match = selectMatchingCustomer(candidates, {});
    expect(match).toBeNull();
  });
});
