import { apiFetch, type ApiClientConfig } from "./client.js";

export type CustomerLabel = { singular: string; plural: string };

// Mirrors apps/api's resolveCustomerLabel() default — used before the
// /admin/me fetch resolves, or if it ever fails, so the UI never renders
// with an undefined label.
export const DEFAULT_CUSTOMER_LABEL: CustomerLabel = { singular: "Customer", plural: "Customers" };

export type StaffMember = { id: string; userId: string; roleKey: string };

export type Me = { staffMember: StaffMember; customerLabel: CustomerLabel };

export async function getMe(config: ApiClientConfig): Promise<Me> {
  return apiFetch(config, "/admin/me");
}
