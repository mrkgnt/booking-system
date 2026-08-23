import { describe, expect, it } from "vitest";
import { validateForceBookForm } from "../../../src/lib/api/validate-force-book.js";

const base = { serviceId: "s1", staffId: "st1", startsAt: "2026-03-01T09:00", locale: "lv", patientName: "Anna", patientEmail: "a@b.com", patientPhone: "" };

describe("validateForceBookForm", () => {
  it("passes with a complete valid form", () => expect(validateForceBookForm(base)).toEqual([]));
  it("requires a service", () => expect(validateForceBookForm({ ...base, serviceId: "" })).toContain("Service is required."));
  it("requires patient email or phone", () => expect(validateForceBookForm({ ...base, patientEmail: "", patientPhone: "" }))
    .toContain("Patient email or phone is required."));
});
