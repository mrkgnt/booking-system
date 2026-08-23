import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type Service = Database["public"]["Tables"]["services"]["Row"] & {
  name: Record<string, string>;
  description?: Record<string, string>;
};
export type StaffMember = Database["public"]["Tables"]["staff"]["Row"] & { bio: Record<string, string> };

export async function listServices(config: ApiClientConfig): Promise<Service[]> {
  const { services } = await apiFetch<{ services: Service[] }>(config, "/admin/services");
  return services;
}

export async function listStaff(config: ApiClientConfig): Promise<StaffMember[]> {
  const { staff } = await apiFetch<{ staff: StaffMember[] }>(config, "/admin/staff");
  return staff;
}
