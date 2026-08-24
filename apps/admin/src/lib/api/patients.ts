import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";
import type { Booking } from "./bookings.js";

export type Patient = Database["public"]["Tables"]["patients"]["Row"];

export async function listPatients(config: ApiClientConfig, q?: string): Promise<Patient[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const { patients } = await apiFetch<{ patients: Patient[] }>(config, `/admin/patients${qs}`);
  return patients;
}

export async function getPatient(config: ApiClientConfig, id: string): Promise<{ patient: Patient; bookings: Booking[] }> {
  return apiFetch(config, `/admin/patients/${id}`);
}

export type UpdatePatientInput = Partial<{ name: string; email: string; phone: string; notes: string }>;

export async function updatePatient(config: ApiClientConfig, id: string, input: UpdatePatientInput): Promise<Patient> {
  const { patient } = await apiFetch<{ patient: Patient }>(config, `/admin/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return patient;
}
