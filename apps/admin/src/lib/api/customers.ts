import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";
import type { Booking } from "./bookings.js";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];

export async function listCustomers(config: ApiClientConfig, q?: string): Promise<Customer[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const { customers } = await apiFetch<{ customers: Customer[] }>(config, `/admin/customers${qs}`);
  return customers;
}

export async function getCustomer(config: ApiClientConfig, id: string): Promise<{ customer: Customer; bookings: Booking[] }> {
  return apiFetch(config, `/admin/customers/${id}`);
}

export type UpdateCustomerInput = Partial<{ name: string; email: string; phone: string; notes: string }>;

export async function updateCustomer(config: ApiClientConfig, id: string, input: UpdateCustomerInput): Promise<Customer> {
  const { customer } = await apiFetch<{ customer: Customer }>(config, `/admin/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return customer;
}
