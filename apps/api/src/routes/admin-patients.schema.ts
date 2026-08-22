import { z } from "zod";

export const listPatientsQuerySchema = z.object({
  q: z.string().min(1).max(200).optional(),
});
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

export const patientIdParamSchema = z.object({ id: z.string().uuid() });

export const updatePatientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(32).optional(),
  notes: z.string().max(5000).optional(),
});
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
