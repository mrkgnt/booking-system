import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type Closure = Database["public"]["Tables"]["closures"]["Row"];

export async function listClosures(config: ApiClientConfig, staffId?: string | null): Promise<Closure[]> {
  const qs = staffId ? `?staffId=${staffId}` : "";
  const { closures } = await apiFetch<{ closures: Closure[] }>(config, `/admin/closures${qs}`);
  return closures;
}

export type ClosureInput = {
  staffId: string | null;
  startsOn: string;
  endsOn: string;
  reason?: string;
  isRecurringYearly: boolean;
};

export async function createClosure(config: ApiClientConfig, input: ClosureInput): Promise<Closure> {
  const { closure } = await apiFetch<{ closure: Closure }>(config, "/admin/closures", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return closure;
}

export async function deleteClosure(config: ApiClientConfig, id: string): Promise<void> {
  await apiFetch<void>(config, `/admin/closures/${id}`, { method: "DELETE" });
}
