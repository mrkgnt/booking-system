import { describe, expect, it } from "vitest";
import { validateForceBookForm } from "../../../src/lib/api/validate-force-book.js";

const base = { serviceId: "s1", staffId: "st1", startsAt: "2026-03-01T09:00", locale: "lv", customerName: "Anna", customerEmail: "a@b.com", customerPhone: "" };

describe("validateForceBookForm", () => {
  it("passes with a complete valid form", () => expect(validateForceBookForm(base)).toEqual([]));
  it("requires a service", () => expect(validateForceBookForm({ ...base, serviceId: "" })).toContain("Service is required."));
  it("requires customer email or phone", () => expect(validateForceBookForm({ ...base, customerEmail: "", customerPhone: "" }))
    .toContain("Customer email or phone is required."));
  it("uses the tenant's configured label in its messages", () => {
    const label = { singular: "Patient", plural: "Patients" };
    const errors = validateForceBookForm({ ...base, customerName: "", customerEmail: "", customerPhone: "" }, label);
    expect(errors).toContain("Patient name is required.");
    expect(errors).toContain("Patient email or phone is required.");
  });
});
