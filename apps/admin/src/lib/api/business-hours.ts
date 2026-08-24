import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type BusinessHour = Database["public"]["Tables"]["business_hours"]["Row"];

export async function listBusinessHours(config: ApiClientConfig, staffId?: string | null): Promise<BusinessHour[]> {
  const qs = staffId ? `?staffId=${staffId}` : "";
  const { businessHours } = await apiFetch<{ businessHours: BusinessHour[] }>(config, `/admin/business-hours${qs}`);
  return businessHours;
}

export type HourInput = { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean };

export async function replaceBusinessHours(
  config: ApiClientConfig,
  staffId: string | null,
  hours: HourInput[],
): Promise<BusinessHour[]> {
  const { businessHours } = await apiFetch<{ businessHours: BusinessHour[] }>(config, "/admin/business-hours", {
    method: "PUT",
    body: JSON.stringify({ staffId, hours }),
  });
  return businessHours;
}
