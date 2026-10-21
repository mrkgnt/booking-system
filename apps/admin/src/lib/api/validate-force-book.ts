import { DEFAULT_CUSTOMER_LABEL, type CustomerLabel } from "./me.js";

export type ForceBookFormValues = {
  serviceId: string; staffId: string; startsAt: string; locale: string;
  customerName: string; customerEmail: string; customerPhone: string;
};

export function validateForceBookForm(values: ForceBookFormValues, label: CustomerLabel = DEFAULT_CUSTOMER_LABEL): string[] {
  const errors: string[] = [];
  if (!values.serviceId) errors.push("Service is required.");
  if (!values.staffId) errors.push("Staff member is required.");
  if (!values.startsAt) errors.push("Start time is required.");
  if (!values.customerName.trim()) errors.push(`${label.singular} name is required.`);
  if (!values.customerEmail.trim() && !values.customerPhone.trim()) errors.push(`${label.singular} email or phone is required.`);
  return errors;
}
