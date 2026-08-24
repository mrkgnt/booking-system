import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type ServiceCategory = Database["public"]["Tables"]["service_categories"]["Row"] & {
  name: Record<string, string>;
};

export type ServiceCategoryInput = {
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  name: Record<"lv" | "ru" | "en", string>;
};

export async function listServiceCategories(config: ApiClientConfig): Promise<ServiceCategory[]> {
  const { serviceCategories } = await apiFetch<{ serviceCategories: ServiceCategory[] }>(config, "/admin/service-categories");
  return serviceCategories;
}

export async function createServiceCategory(config: ApiClientConfig, input: ServiceCategoryInput): Promise<ServiceCategory> {
  const { serviceCategory } = await apiFetch<{ serviceCategory: ServiceCategory }>(config, "/admin/service-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return serviceCategory;
}

export async function updateServiceCategory(
  config: ApiClientConfig,
  id: string,
  input: Partial<ServiceCategoryInput>,
): Promise<ServiceCategory> {
  const { serviceCategory } = await apiFetch<{ serviceCategory: ServiceCategory }>(config, `/admin/service-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return serviceCategory;
}

export async function deleteServiceCategory(config: ApiClientConfig, id: string): Promise<void> {
  await apiFetch<void>(config, `/admin/service-categories/${id}`, { method: "DELETE" });
}
