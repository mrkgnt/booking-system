// Resolves the staff-facing display label for the generic "Customer" domain
// concept (see docs/adr/0002-generic-customer-term-with-tenant-display-labels.md).
// A tenant whose own customers go by other vocabulary (e.g. a dental clinic's
// "Patients") sets business_profile.site_config.customerLabel; everyone else
// gets the generic default. Decouples the schema/domain term from what staff
// actually see.

export type CustomerLabel = {
  singular: string;
  plural: string;
};

const DEFAULT_LABEL: CustomerLabel = { singular: "Customer", plural: "Customers" };

function isCustomerLabel(value: unknown): value is CustomerLabel {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).singular === "string" &&
    typeof (value as Record<string, unknown>).plural === "string"
  );
}

export function resolveCustomerLabel(siteConfig: unknown): CustomerLabel {
  if (typeof siteConfig !== "object" || siteConfig === null) {
    return DEFAULT_LABEL;
  }
  const override = (siteConfig as Record<string, unknown>).customerLabel;
  return isCustomerLabel(override) ? override : DEFAULT_LABEL;
}
