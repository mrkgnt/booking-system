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

export type ServiceInput = {
  categoryId?: string | null;
  durationMinutes: number;
  bufferMinutesBefore: number;
  bufferMinutesAfter: number;
  priceAmount?: number | null;
  priceCurrency: string;
  pricePrefix: "exact" | "from" | "up_to";
  displayOrder: number;
  isActive: boolean;
  name: Record<"lv" | "ru" | "en", string>;
  description?: Record<"lv" | "ru" | "en", string>;
};

export async function createService(config: ApiClientConfig, input: ServiceInput): Promise<Service> {
  const { service } = await apiFetch<{ service: Service }>(config, "/admin/services", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return service;
}

export async function updateService(config: ApiClientConfig, id: string, input: Partial<ServiceInput>): Promise<Service> {
  const { service } = await apiFetch<{ service: Service }>(config, `/admin/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return service;
}

export async function deleteService(config: ApiClientConfig, id: string): Promise<void> {
  await apiFetch<void>(config, `/admin/services/${id}`, { method: "DELETE" });
}
