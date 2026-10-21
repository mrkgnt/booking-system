import { describe, expect, it } from "vitest";
import { resolveCustomerLabel } from "../src/lib/customer-label.js";

describe("resolveCustomerLabel", () => {
  it("defaults to Customer/Customers when site_config has no label override", () => {
    expect(resolveCustomerLabel({})).toEqual({ singular: "Customer", plural: "Customers" });
  });

  it("defaults when site_config is null or undefined", () => {
    expect(resolveCustomerLabel(null)).toEqual({ singular: "Customer", plural: "Customers" });
    expect(resolveCustomerLabel(undefined)).toEqual({ singular: "Customer", plural: "Customers" });
  });

  it("uses the tenant's configured label when present", () => {
    expect(
      resolveCustomerLabel({ customerLabel: { singular: "Patient", plural: "Patients" } }),
    ).toEqual({ singular: "Patient", plural: "Patients" });
  });

  it("falls back to the default when customerLabel is malformed", () => {
    expect(resolveCustomerLabel({ customerLabel: { singular: "Patient" } })).toEqual({
      singular: "Customer",
      plural: "Customers",
    });
    expect(resolveCustomerLabel({ customerLabel: "Patients" })).toEqual({
      singular: "Customer",
      plural: "Customers",
    });
  });
});
